import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { organizations, users, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
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

    const { orgId } = await params;
    console.log('Deleting organization:', orgId);

    // Get organization details for logging
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    console.log('Found organization to delete:', organization);

    // 1. Delete all organization members first (to avoid foreign key constraints)
    const deletedMembers = await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.organizationUuid, orgId))
      .returning();

    console.log('Deleted organization members:', deletedMembers);

    // 2. Delete all users who were only part of this organization
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
          // Delete from Supabase Auth first (if not invitation_pending)
          if (userToDelete.passwordHash !== 'invitation_pending') {
            const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
              userToDelete.authId
            );
            if (deleteAuthError) {
              console.error('Failed to delete Supabase auth user:', deleteAuthError);
            } else {
              console.log('✅ Deleted Supabase auth user:', userToDelete.email);
            }
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

    // 3. Finally, delete the organization
    const deletedOrg = await db
      .delete(organizations)
      .where(eq(organizations.id, orgId))
      .returning();

    console.log('Deleted organization:', deletedOrg);

    return NextResponse.json({
      success: true,
      message: `Organization "${organization.name}" and all associated data has been permanently deleted.`,
      deletedOrganization: organization,
      deletedMembers: deletedMembers.length,
    });

  } catch (error) {
    console.error('Error deleting organization:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
