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
import { eq } from 'drizzle-orm';

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
  name: z.string().min(1).max(100).optional(),
  organizationName: z.string().min(1).max(100).optional(),
  inviteId: z.string().optional(),
});

export async function signUp(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;
  const organizationName = formData.get('organizationName') as string;
  const inviteId = formData.get('inviteId') as string;

  const result = signUpSchema.safeParse({ email, password, name, organizationName, inviteId });
  if (!result.success) {
    return {
      error: 'Invalid form data. Please check your inputs.',
      email,
      password
    };
  }

  const supabase = await createSupabaseServerClient();

  // Create user in Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name || null,
        role: 'super_admin',
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

  try {
    // Create user record in our database
    const [dbUser] = await db
      .insert(users)
      .values({
        authId: data.user.id,
        email: data.user.email!,
        name: name || data.user.email!.split('@')[0],
        role: 'member', // Default role, will be updated based on invitation
        passwordHash: 'supabase_managed',
      })
      .returning();

    let targetOrganization = null;
    let userRole = 'member';

    // Check if this is an invitation-based signup
    if (inviteId) {
      const [invitation] = await db
        .select()
        .from(invitations)
        .where(eq(invitations.id, parseInt(inviteId)))
        .limit(1);

      if (invitation && invitation.email === email && invitation.status === 'pending') {
        // Get the organization from the invitation
        if (invitation.organizationId) {
          const [org] = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, invitation.organizationId))
            .limit(1);
          
          if (org) {
            targetOrganization = org;
            userRole = invitation.role;

            // Mark invitation as accepted
            await db
              .update(invitations)
              .set({ 
                status: 'accepted',
                acceptedAt: new Date()
              })
              .where(eq(invitations.id, invitation.id));
          }
        }
      } else {
        return {
          error: 'Invalid or expired invitation.',
          email,
          password
        };
      }
    } else {
      // No invitation - create new organization (Super Admin signup)
      const [newOrg] = await db
        .insert(organizations)
        .values({
          name: organizationName || `${email}'s Organization`,
          type: 'internal',
          code: organizationName?.substring(0, 3).toUpperCase() || 'ORG',
          uuid: crypto.randomUUID(),
        })
        .returning();
      
      targetOrganization = newOrg;
      userRole = 'super_admin';
    }

    // Update user role based on invitation or default
    await db
      .update(users)
      .set({ role: userRole })
      .where(eq(users.authId, data.user.id));

    // Add user to organization
    if (targetOrganization) {
      await db
        .insert(organizationMembers)
        .values({
          userId: dbUser.id,
          organizationId: targetOrganization.id,
          role: userRole,
        });
    }

    redirect('/dashboard');
  } catch (dbError) {
    console.error('Database error during signup:', dbError);
    
    return {
      error: 'Failed to complete registration. Please try again.',
      email,
      password
    };
  }
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