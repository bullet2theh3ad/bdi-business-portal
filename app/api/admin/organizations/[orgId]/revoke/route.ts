import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { organizations, users, organizationMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create admin client for user deletion
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify super admin permission
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser || requestingUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden - Super Admin required' }, { status: 403 });
    }

    const { orgId } = params;
    console.log('Revoking invitation for organization:', orgId);

    // Get organization details
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Only allow revoking if organization is inactive (pending invitation)
    if (organization.isActive) {
      return NextResponse.json(
        { error: 'Cannot revoke invitation for active organization. Use delete instead.' },
        { status: 400 }
      );
    }

    console.log('Found pending organization to revoke:', organization);

    // 1. Delete organization members
    const deletedMembers = await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.organizationUuid, orgId))
      .returning();

    console.log('Deleted organization members:', deletedMembers);

    // 2. Delete all users associated with this organization (both pending and active)
    for (const member of deletedMembers) {
      // Check if this user has other organization memberships
      const otherMemberships = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.userAuthId, member.userAuthId))
        .limit(1);

      // If no other memberships, delete the user (regardless of pending/active status)
      if (otherMemberships.length === 0) {
        const [userToDelete] = await db
          .select()
          .from(users)
          .where(eq(users.authId, member.userAuthId))
          .limit(1);

        if (userToDelete) {
          // Delete from Supabase Auth (for invited users, this should always exist now)
          const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
            userToDelete.authId
          );
          if (deleteAuthError) {
            console.error('Failed to delete Supabase auth user:', deleteAuthError);
          } else {
            console.log('✅ Deleted Supabase auth user:', userToDelete.email);
          }

          // Delete from our database
          await db
            .delete(users)
            .where(eq(users.authId, member.userAuthId));
          
          console.log('✅ Deleted database user:', userToDelete.email, 'Status:', userToDelete.passwordHash);
        }
      } else {
        console.log('User has other memberships, not deleting:', member.userAuthId);
      }
    }

    // 3. Delete the organization
    const deletedOrg = await db
      .delete(organizations)
      .where(eq(organizations.id, orgId))
      .returning();

    console.log('Deleted organization:', deletedOrg);

    return NextResponse.json({
      success: true,
      message: `Invitation for "${organization.name}" has been revoked and organization deleted.`,
      deletedOrganization: organization,
      deletedMembers: deletedMembers.length,
    });

  } catch (error) {
    console.error('Error revoking organization invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
