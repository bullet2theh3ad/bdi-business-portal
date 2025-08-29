'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import {
  organizations,
  organizationMembers,
} from '@/lib/db/schema';

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
});

export async function signUp(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;
  const organizationName = formData.get('organizationName') as string;

  const result = signUpSchema.safeParse({ email, password, name, organizationName });
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
    // Create organization
    const newOrg = {
      name: organizationName || `${email}'s Organization`,
      type: 'internal' as const,
      code: 'BDI',
      is_active: true,
      created_by: null // Will be updated once we have profiles table
    };

    const [createdOrg] = await db.insert(organizations).values(newOrg).returning();

    if (createdOrg) {
      // Create organization membership
      const newOrgMember = {
        user_id: data.user.id, // Use Supabase auth user ID (UUID)
        organization_id: createdOrg.id,
        role: 'super_admin' as const
      };

      await db.insert(organizationMembers).values(newOrgMember);
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