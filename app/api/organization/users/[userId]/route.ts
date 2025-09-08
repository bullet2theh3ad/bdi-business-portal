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
    .where(eq(users.email, authUser.email!))
    .limit(1);

  return dbUser;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
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

    // Prevent BDI users from using this endpoint
    if (userOrganization.code === 'BDI' || userOrganization.type === 'internal') {
      return NextResponse.json({ error: 'BDI users should use admin endpoints' }, { status: 403 });
    }

    const { userId } = await params;
    console.log('Deleting organization user:', userId);

    // Get user details for logging and verification
    const [userToDelete] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userToDelete) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify the user belongs to the same organization as the admin
    const [userMembership] = await db
      .select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userAuthId, userToDelete.authId),
        eq(organizationMembers.organizationUuid, userOrganization.id)
      ))
      .limit(1);

    if (!userMembership) {
      return NextResponse.json({ error: 'User does not belong to your organization' }, { status: 403 });
    }

    // Prevent self-deletion
    if (userToDelete.authId === currentUser.authId) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    // Get current user's organization membership role
    const [currentUserMembership] = await db
      .select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userAuthId, currentUser.authId),
        eq(organizationMembers.organizationUuid, userOrganization.id)
      ))
      .limit(1);

    if (!currentUserMembership) {
      return NextResponse.json({ error: 'Current user membership not found' }, { status: 403 });
    }

    // Role hierarchy protection: prevent lower roles from deleting higher roles
    const roleHierarchy = ['member', 'admin', 'owner', 'super_admin'];
    const currentUserRoleLevel = roleHierarchy.indexOf(currentUserMembership.role);
    const targetUserRoleLevel = roleHierarchy.indexOf(userMembership.role);

    // Only allow deletion if current user has higher or equal role level
    if (currentUserRoleLevel < targetUserRoleLevel) {
      return NextResponse.json({ 
        error: `Cannot delete user with higher role. Your role: ${currentUserMembership.role}, Target role: ${userMembership.role}` 
      }, { status: 403 });
    }

    // Additional protection: members cannot delete admins, even if they have admin system role
    if (currentUserMembership.role === 'member' && userMembership.role === 'admin') {
      return NextResponse.json({ 
        error: 'Organization members cannot delete organization admins' 
      }, { status: 403 });
    }

    console.log(`Permission check passed: ${currentUserMembership.role} deleting ${userMembership.role}`);

    console.log('Found user to delete:', userToDelete);

    // 1. Delete organization membership
    await db
      .delete(organizationMembers)
      .where(and(
        eq(organizationMembers.userAuthId, userToDelete.authId),
        eq(organizationMembers.organizationUuid, userOrganization.id)
      ));

    console.log('Deleted organization membership');

    // 2. Check if user has other organization memberships
    const otherMemberships = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userAuthId, userToDelete.authId))
      .limit(1);

    // 3. If no other memberships, delete the user completely
    if (otherMemberships.length === 0) {
      await db
        .delete(users)
        .where(eq(users.authId, userToDelete.authId));
      
      console.log('Deleted user completely:', userToDelete.email);
    } else {
      console.log('User has other memberships, only removed from this organization');
    }

    return NextResponse.json({
      success: true,
      message: `User "${userToDelete.name}" has been removed from ${userOrganization.name}.`,
      deletedUser: {
        id: userToDelete.id,
        name: userToDelete.name,
        email: userToDelete.email
      },
      completelyDeleted: otherMemberships.length === 0
    });

  } catch (error) {
    console.error('Error deleting organization user:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
