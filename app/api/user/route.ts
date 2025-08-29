import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizationMembers, organizations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { user: authUser }, error } = await supabase.auth.getUser();
    
    if (error || !authUser) {
      return Response.json(null);
    }

    // Always find user by email to avoid UUID transition issues
    let [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, authUser.email!))
      .limit(1);

    if (!dbUser) {
      // Create new user with proper auth_id
      [dbUser] = await db
        .insert(users)
        .values({
          authId: authUser.id,
          email: authUser.email!,
          name: authUser.user_metadata?.name || authUser.email!.split('@')[0],
          role: authUser.user_metadata?.role || 'super_admin',
          passwordHash: 'supabase_managed', // Placeholder since Supabase manages auth
        })
        .returning();
    } else {
      // Always update existing user with current auth_id (in case it changed or was missing)
      [dbUser] = await db
        .update(users)
        .set({ authId: authUser.id })
        .where(eq(users.email, authUser.email!))
        .returning();
    }

    // Check if user is a member of any organizations (based on invitations/assignments)
    const userOrganizations = await db
      .select({
        organization: {
          id: organizations.id,
          name: organizations.name,
          code: organizations.code,
        },
        membershipRole: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
      .where(eq(organizationMembers.userAuthId, dbUser.authId));

    // For Super Admin, provide a default organization for now
    if (dbUser.role === 'super_admin' && userOrganizations.length === 0) {
      // Provide default BDI organization info for Super Admin
      userOrganizations.push({
        organization: {
          id: crypto.randomUUID(), // Temporary UUID for Super Admin
          name: 'Boundless Devices Inc',
          code: 'BDI',
        },
        membershipRole: 'owner',
      });
    }

    // Return user with their organization memberships
    return Response.json({
      ...dbUser,
      organizations: userOrganizations,
      // For backwards compatibility, use the first organization as primary
      organization: userOrganizations.length > 0 ? userOrganizations[0].organization : null
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return Response.json(null);
  }
}
