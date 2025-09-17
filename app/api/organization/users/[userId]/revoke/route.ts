import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { organizations, users, organizationMembers } from '@/lib/db/schema';
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

async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user: authUser }, error } = await supabase.auth.getUser();
  
  if (error || !authUser) {
    return null;
  }

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.authId, authUser.id))
    .limit(1);

  return dbUser;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || !['admin', 'super_admin'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Unauthorized - Organization Admin required' }, { status: 401 });
    }

    // Get the user's organization
    const [userOrgMembership] = await db
      .select({
        organization: {
          id: organizations.id,
          code: organizations.code,
          name: organizations.name,
          type: organizations.type,
        }
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
      .where(eq(organizationMembers.userAuthId, currentUser.authId))
      .limit(1);

    if (!userOrgMembership) {
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 403 });
    }

    const userOrganization = userOrgMembership.organization;

    const { userId } = await params;
    console.log('🔍 REVOKE DEBUG - Revoking invitation for user ID:', userId);

    // Get user details for logging and verification
    const [userToRevoke] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userToRevoke) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('🔍 REVOKE DEBUG - Found user to revoke:', {
      email: userToRevoke.email,
      name: userToRevoke.name,
      isActive: userToRevoke.isActive,
      passwordHash: userToRevoke.passwordHash,
      deletedAt: userToRevoke.deletedAt
    });

    // Verify the user belongs to the same organization as the admin
    const [userMembership] = await db
      .select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userAuthId, userToRevoke.authId),
        eq(organizationMembers.organizationUuid, userOrganization.id)
      ))
      .limit(1);

    if (!userMembership) {
      return NextResponse.json({ error: 'User is not a member of your organization' }, { status: 403 });
    }

    console.log('🔍 REVOKE DEBUG - User membership verified');

    // STEP 1: Delete organization membership FIRST
    await db
      .delete(organizationMembers)
      .where(and(
        eq(organizationMembers.userAuthId, userToRevoke.authId),
        eq(organizationMembers.organizationUuid, userOrganization.id)
      ));

    console.log('✅ REVOKE DEBUG - Deleted organization membership');

    // STEP 2: Check if user has other organization memberships
    const otherMemberships = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userAuthId, userToRevoke.authId))
      .limit(1);

    console.log('🔍 REVOKE DEBUG - Other memberships count:', otherMemberships.length);

    // STEP 3: If no other memberships, delete the user completely
    if (otherMemberships.length === 0) {
      // Delete from database first
      await db
        .delete(users)
        .where(eq(users.authId, userToRevoke.authId));
      
      console.log('✅ REVOKE DEBUG - Deleted user from database:', userToRevoke.email);

      // STEP 4: Also delete from Supabase auth to prevent future conflicts
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userToRevoke.authId);
        
        if (deleteAuthError) {
          console.error('❌ REVOKE DEBUG - Failed to delete Supabase auth user:', deleteAuthError);
          // Don't fail the whole operation - database deletion succeeded
        } else {
          console.log('✅ REVOKE DEBUG - Deleted Supabase auth user:', userToRevoke.email);
        }
      } catch (authError) {
        console.error('❌ REVOKE DEBUG - Error deleting Supabase auth user:', authError);
        // Don't fail the whole operation - database deletion succeeded
      }
      
      console.log('✅ REVOKE DEBUG - User completely removed (database + auth):', userToRevoke.email);
    } else {
      console.log('✅ REVOKE DEBUG - User has other memberships, only removed from this organization');
    }

    return NextResponse.json({
      success: true,
      message: `Invitation for ${userToRevoke.name} (${userToRevoke.email}) has been revoked and completely removed.`,
      userEmail: userToRevoke.email,
      completelyDeleted: otherMemberships.length === 0
    });

  } catch (error) {
    console.error('❌ REVOKE DEBUG - Error revoking invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
