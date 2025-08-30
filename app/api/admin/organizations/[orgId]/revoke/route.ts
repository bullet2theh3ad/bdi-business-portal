import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { organizations, users, organizationMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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

    // 2. Delete all pending users associated with this organization
    for (const member of deletedMembers) {
      const [userToDelete] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.authId, member.userAuthId),
            eq(users.passwordHash, 'invitation_pending'),
            eq(users.isActive, false)
          )
        )
        .limit(1);

      if (userToDelete) {
        await db
          .delete(users)
          .where(eq(users.authId, member.userAuthId));
        
        console.log('Deleted pending user:', userToDelete.email);
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
