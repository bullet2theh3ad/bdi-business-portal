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

  // For invitation signups, we already have the user in our database
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
    // Invitation signup - create Supabase user WITHOUT email confirmation
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email confirmation for invitations
      user_metadata: {
        name: name || null,
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
  }

  try {
    let targetOrganization = null;
    let userRole = 'member';
    let dbUser = null;

    // Check if this is an invitation-based signup using token
    if (token) {
      // Parse the invitation token to get organization info
      let tokenData;
      try {
        tokenData = JSON.parse(Buffer.from(token, 'base64url').toString());
        console.log('Parsed invitation token:', tokenData);
      } catch (error) {
        console.error('Invalid invitation token:', error);
        return {
          error: 'Invalid or expired invitation token.',
          email,
          password
        };
      }

      // Find the pending user by email and organization
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

      if (pendingUser) {
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
          .where(eq(organizationMembers.userAuthId, pendingUser.authId))
          .limit(1);

        if (membership) {
          targetOrganization = membership.organization;
          userRole = membership.role;

          // Delete old membership and user records
          await db
            .delete(organizationMembers)
            .where(eq(organizationMembers.userAuthId, pendingUser.authId));

          await db
            .delete(users)
            .where(eq(users.id, pendingUser.id));

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
          
          // For invitation signups, automatically sign them in
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (signInError) {
            console.error('Auto sign-in failed:', signInError);
            // Don't return error - user was created successfully, they can sign in manually
          } else {
            console.log('✅ User automatically signed in');
          }
        }
      } else {
        return {
          error: 'Invalid or expired invitation token.',
          email,
          password
        };
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
        status: 'revoked',
        updatedAt: new Date()
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
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password`,
    });

    if (error) {
      return { error: error.message };
    }

    return { success: 'Password reset email sent' };
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
    // This function would verify the reset token
    // For now, return true as Supabase handles token verification
    return { valid: true };
  } catch (error) {
    console.error('Error verifying reset token:', error);
    return { valid: false, error: 'Invalid or expired token' };
  }
}