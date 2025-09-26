'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import {
  organizations,
  organizationMembers,
  invitations,
  users,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// Create Supabase server client
async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100)
});

export async function signIn(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const result = signInSchema.safeParse({ email, password });
  if (!result.success) {
    return {
      error: 'Invalid email or password format.',
      email,
      password
    };
  }

  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error: 'Invalid email or password. Please try again.',
      email,
      password
    };
  }

  redirect('/dashboard');
}

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  organizationName: z.string().optional(),
  token: z.string().optional(),
});

export async function signUp(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;
  const organizationName = formData.get('organizationName') as string;
  const token = formData.get('token') as string;
  
  // DEBUG: Log form data (sensitive data redacted)
  console.log('🔍 FORM DEBUG - Form submission received');
  console.log('🔍 FORM DEBUG - Has email:', !!email);
  console.log('🔍 FORM DEBUG - Has password:', !!password);
  console.log('🔍 FORM DEBUG - Has name:', !!name);
  console.log('🔍 FORM DEBUG - Has token:', !!token);

  // For invitation signups, organizationName is not required
  const validationData = token 
    ? { email, password, name, token }  // Invitation signup - no organizationName needed
    : { email, password, name, organizationName, token }; // Regular signup - organizationName required

  const result = signUpSchema.safeParse(validationData);
  if (!result.success) {
    console.error('Validation errors:', result.error.errors);
    return {
      error: `Invalid form data: ${result.error.errors.map(e => e.message).join(', ')}`,
      email,
      password
    };
  }

  const supabase = await createSupabaseServerClient();
  let supabaseUser = null;

  // For invitation signups, Supabase user already exists - just update password and sign in
  // For regular signups, we need to create them in Supabase Auth
  if (!token) {
    // Regular signup - create user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined,
        data: {
          name: name || null,
          role: 'member',
        }
      }
    });

    if (error) {
      return {
        error: error.message || 'Failed to create user. Please try again.',
        email,
        password
      };
    }

    if (!data.user) {
      return {
        error: 'Failed to create user. Please try again.',
        email,
        password
      };
    }

    supabaseUser = data.user;
  } else {
    // Invitation signup - parse token to get Supabase user ID
    let tokenData;
    try {
      tokenData = JSON.parse(Buffer.from(token, 'base64url').toString());
      console.log('Parsed invitation token for password update:', { email: tokenData.adminEmail, supabaseUserId: tokenData.supabaseUserId });
    } catch (error) {
      console.error('Invalid invitation token:', error);
      return {
        error: 'Invalid or expired invitation token.',
        email,
        password
      };
    }

    // Update the existing Supabase user's password using admin client
    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get() { return undefined; },
          set() {},
          remove() {},
        },
      }
    );

    // Check if this is an organization setup invitation (has supabaseUserId) or user invitation (no supabaseUserId)
    if (tokenData.supabaseUserId) {
      console.log('🔍 SIGNUP DEBUG - Organization setup invitation - updating existing Supabase user');
      const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        tokenData.supabaseUserId,
        {
          password: password,
          user_metadata: {
            name: name || null,
            password_set: true,
          }
        }
      );

      if (updateError || !updateData.user) {
        console.error('Failed to update user password:', updateError);
        return {
          error: 'Failed to set password. Please try again.',
          email,
          password
        };
      }

      console.log('✅ Updated Supabase user password for invitation signup');
      supabaseUser = updateData.user;
    } else {
      console.log('🔍 SIGNUP DEBUG - User invitation - creating new Supabase user');
      // This is a user invitation - create new Supabase user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined,
          data: {
            name: name || null,
            role: tokenData.role || 'member',
          }
        }
      });

      if (error || !data.user) {
        console.error('Failed to create Supabase user:', error);
        return {
          error: error?.message || 'Failed to create user. Please try again.',
          email,
          password
        };
      }

      console.log('✅ Created new Supabase user for invitation signup');
      supabaseUser = data.user;
    }
  }

  try {
    let targetOrganization = null;
    let userRole = 'member';
    let dbUser = null;

    // Check if this is an invitation-based signup using token
    if (token) {
      // DEBUG: Log token processing (sensitive data redacted)
      console.log('🔍 SIGNUP DEBUG - Processing invitation token');
      console.log('🔍 SIGNUP DEBUG - Token length:', token.length);
      console.log('🔍 SIGNUP DEBUG - Has email:', !!email);
      
      // Parse the invitation token to get organization info
      let tokenData;
      // Parse Base64URL JSON token (new format)
      try {
        tokenData = JSON.parse(Buffer.from(token, 'base64url').toString());
        console.log('🔍 SIGNUP DEBUG - Token parsed successfully');
        console.log('🔍 SIGNUP DEBUG - Token data:', {
          orgId: tokenData.orgId,
          email: tokenData.email,
          role: tokenData.role,
          timestamp: tokenData.ts
        });
      } catch (error) {
        console.error('🔍 SIGNUP DEBUG - Token parsing failed:', error);
        console.error('🔍 SIGNUP DEBUG - Token received:', token);
        return {
          error: 'Invalid or expired invitation token.',
          email,
          password
        };
      }

      // Verify token data matches signup email
      if (tokenData.email !== email) {
        console.error('🔍 SIGNUP DEBUG - Email mismatch:', {
          tokenEmail: tokenData.email,
          signupEmail: email
        });
        return {
          error: 'Invalid or expired invitation token.',
          email,
          password
        };
      }

      // Find the pending user by email (original system)
      console.log('🔍 SIGNUP DEBUG - Looking for pending user');
      
      const [pendingUser] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.email, email),
            eq(users.passwordHash, 'invitation_pending'),
            eq(users.isActive, false)
          )
        )
        .limit(1);
        
      console.log('🔍 SIGNUP DEBUG - Found pending user:', !!pendingUser);

      if (!pendingUser) {
        console.error('🔍 SIGNUP DEBUG - No pending user found for email:', email);
        return {
          error: 'Invalid or expired invitation token.',
          email,
          password
        };
      }

      // Get the organization from the user's membership
      const [membership] = await db
        .select({
          organization: {
            id: organizations.id,
            name: organizations.name,
            code: organizations.code,
          },
          role: organizationMembers.role,
        })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
        .where(eq(organizationMembers.userAuthId, pendingUser.authId!))
        .limit(1);

      if (!membership) {
        console.error('🔍 SIGNUP DEBUG - No organization membership found');
        return {
          error: 'Invalid or expired invitation token.',
          email,
          password
        };
      }

      targetOrganization = membership.organization;
      userRole = membership.role;

      console.log('🔍 SIGNUP DEBUG - Updating user with real Supabase auth ID');

      // Delete old membership and user records
      await db
        .delete(organizationMembers)
        .where(eq(organizationMembers.userAuthId, pendingUser.authId!));

      await db
        .delete(users)
        .where(eq(users.id, pendingUser.id!));

      // Create fresh user record with correct Supabase auth ID
      [dbUser] = await db
        .insert(users)
        .values({
          authId: supabaseUser.id,
          email: supabaseUser.email!,
          name: pendingUser.name || name || supabaseUser.email!.split('@')[0],
          role: userRole,
          title: pendingUser.title,
          department: pendingUser.department,
          supplierCode: targetOrganization.code, // Set supplier_code to organization code
          passwordHash: 'supabase_managed',
          isActive: true,
        })
        .returning();

      // Create fresh organization membership
      await db
        .insert(organizationMembers)
        .values({
          userAuthId: supabaseUser.id,
          organizationUuid: targetOrganization.id,
          role: userRole,
        });

      console.log('✅ Created fresh user from invitation:', dbUser?.email);
      console.log('✅ Replaced pending user with real Supabase auth user');
      
      // Activate the organization when the admin completes signup
      await db
        .update(organizations)
        .set({
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, targetOrganization.id));
      
      console.log('✅ Activated organization:', targetOrganization.name);
      
      // For invitation signups, automatically sign them in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) {
        console.error('Auto sign-in failed:', signInError);
        // Don't return error - user was created successfully, they can sign in manually
      } else {
        console.log('✅ User automatically signed in after invitation signup');
      }
    } else {
      // No invitation - create new user and organization (Super Admin signup)
      [dbUser] = await db
        .insert(users)
        .values({
          authId: supabaseUser.id,
          email: supabaseUser.email!,
          name: name || supabaseUser.email!.split('@')[0],
          role: 'super_admin',
          passwordHash: 'supabase_managed',
        })
        .returning();

      const [newOrg] = await db
        .insert(organizations)
        .values({
          name: organizationName || `${supabaseUser.email!.split('@')[0]}'s Organization`,
          type: 'internal',
          code: organizationName?.substring(0, 3).toUpperCase() || 'ORG',
        })
        .returning();
      
      targetOrganization = newOrg;
      userRole = 'super_admin';

      // Add user to organization
      await db
        .insert(organizationMembers)
        .values({
          userAuthId: dbUser.authId,
          organizationUuid: targetOrganization.id,
          role: userRole,
        });

      console.log('✅ Created new user and organization:', dbUser?.email);
    }

    // Success - redirect outside try/catch to avoid catching the NEXT_REDIRECT
  } catch (dbError) {
    console.error('Database error during signup:', dbError);
    
    return {
      error: 'Failed to complete registration. Please try again.',
      email,
      password
    };
  }

  // Redirect after successful completion
  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function revokeInvitation(prevState: any, formData: FormData) {
  try {
    const invitationId = parseInt(formData.get('invitationId') as string);
    
    if (!invitationId) {
      return { error: 'Invalid invitation ID' };
    }

    // Update invitation status to revoked
    await db
      .update(invitations)
      .set({ 
        status: 'revoked'
      })
      .where(eq(invitations.id, invitationId));

    return { success: 'Invitation revoked successfully' };
  } catch (error) {
    console.error('Error revoking invitation:', error);
    return { error: 'Failed to revoke invitation' };
  }
}

export async function requestPasswordReset(prevState: any, formData: FormData) {
  try {
    const email = formData.get('email') as string;
    
    if (!email) {
      return { error: 'Email is required' };
    }

    const supabase = await createSupabaseServerClient();
    
    // Use Supabase Auth with your configured Resend SMTP
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `http://localhost:3000/reset-password`,
    });

    if (error) {
      return { error: error.message };
    }

    return { success: 'Password reset email sent via BDI Portal' };
  } catch (error) {
    console.error('Error requesting password reset:', error);
    return { error: 'Failed to send password reset email' };
  }
}

export async function resetPassword(prevState: any, formData: FormData) {
  try {
    const password = formData.get('password') as string;
    
    if (!password || password.length < 8) {
      return { error: 'Password must be at least 8 characters' };
    }

    const supabase = await createSupabaseServerClient();
    
    // Use Supabase Auth to update password (works with Resend SMTP you configured)
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      return { error: error.message };
    }

    redirect('/dashboard');
  } catch (error) {
    console.error('Error resetting password:', error);
    return { error: 'Failed to reset password' };
  }
}

export async function verifyResetToken(token: string) {
  try {
    // Supabase Auth handles token verification automatically
    // Just return valid - Supabase will validate during password reset
    return { valid: true };
  } catch (error) {
    console.error('Error verifying reset token:', error);
    return { valid: false, error: 'Invalid or expired token' };
  }
}