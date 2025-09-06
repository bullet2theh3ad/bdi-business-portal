import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers, organizationInvitations } from '@/lib/db/schema';
import { eq, and, isNull, gte, ne, desc } from 'drizzle-orm';

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

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || !['super_admin', 'admin'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization
    const [userOrgMembership] = await db
      .select({
        organizationId: organizationMembers.organizationUuid,
        organizationCode: organizations.code,
        role: organizationMembers.role
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
      .where(eq(organizationMembers.userAuthId, currentUser.authId))
      .limit(1);

    if (!userOrgMembership) {
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 403 });
    }

    const isSuperAdmin = currentUser.role === 'super_admin';
    const userOrgCode = userOrgMembership.organizationCode;

    // Get all recent organization activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Get pending organization invitations from organization_invitations table
    // Filter by organization unless super admin
    const orgInvitationWhere = isSuperAdmin 
      ? and(
          eq(organizationInvitations.status, 'pending'),
          gte(organizationInvitations.createdAt, thirtyDaysAgo)
        )
      : and(
          eq(organizationInvitations.status, 'pending'),
          eq(organizationInvitations.organizationCode, userOrgCode || ''),
          gte(organizationInvitations.createdAt, thirtyDaysAgo)
        );

    const pendingOrgInvitations = await db
      .select({
        id: organizationInvitations.invitationToken, // Use invitation token as ID for revocation
        organizationCode: organizationInvitations.organizationCode,
        email: organizationInvitations.invitedEmail,
        name: organizationInvitations.invitedName,
        role: organizationInvitations.invitedRole,
        status: organizationInvitations.status,
        createdAt: organizationInvitations.createdAt,
        expiresAt: organizationInvitations.expiresAt,
      })
      .from(organizationInvitations)
      .where(orgInvitationWhere)
      .orderBy(desc(organizationInvitations.createdAt));

    // 2. Get recently created organizations (Add Organization flow)
    // Only show for super admin (BDI), external orgs don't see this
    const recentOrganizations = isSuperAdmin ? await db
      .select({
        id: organizations.id,
        name: organizations.name,
        code: organizations.code,
        type: organizations.type,
        isActive: organizations.isActive,
        createdAt: organizations.createdAt,
        // Get the admin user for this organization
        adminUserId: users.id,
        adminUserName: users.name,
        adminUserEmail: users.email,
        adminUserRole: users.role,
        adminUserIsActive: users.isActive,
      })
      .from(organizations)
      .leftJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationUuid))
      .leftJoin(users, and(
        eq(organizationMembers.userAuthId, users.authId),
        eq(organizationMembers.role, 'admin')
      ))
      .where(
        and(
          gte(organizations.createdAt, thirtyDaysAgo),
          ne(organizations.code, 'BDI') // Exclude BDI itself
        )
      )
      .orderBy(desc(organizations.createdAt))
    : [];

    // 3. Get pending user invitations for current organization
    // Super admin sees BDI invitations, other orgs see their own
    const targetOrgCode = isSuperAdmin ? 'BDI' : (userOrgCode || 'BDI');
    const [targetOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.code, targetOrgCode))
      .limit(1);

    let pendingUserInvitations: any[] = [];
    if (targetOrg) {
      pendingUserInvitations = await db
        .select({
          id: users.id,
          authId: users.authId,
          name: users.name,
          email: users.email,
          role: users.role,
          title: users.title,
          department: users.department,
          invitedAt: users.createdAt,
          resetToken: users.resetToken,
          resetTokenExpiry: users.resetTokenExpiry,
          isActive: users.isActive,
        })
        .from(users)
        .innerJoin(organizationMembers, eq(users.authId, organizationMembers.userAuthId))
        .where(
          and(
            eq(organizationMembers.organizationUuid, targetOrg.id),
            eq(users.isActive, false), // Not yet activated
            eq(users.passwordHash, 'invitation_pending'), // Pending invitation
            isNull(users.deletedAt)
          )
        )
        .orderBy(desc(users.createdAt));
    }

    // Format all activities for the component
    const activities = [
      // Organization invitations (pending)
      ...pendingOrgInvitations.map(inv => ({
        id: `org-invite-${inv.id}`,
        type: 'organization_invitation',
        email: inv.email,
        name: inv.name,
        role: inv.role,
        status: 'pending',
        organizationName: inv.organizationCode, // Use code as name for now
        organizationCode: inv.organizationCode,
        invitedAt: inv.createdAt?.toISOString(),
        expiresAt: inv.expiresAt?.toISOString(),
        invitedBy: currentUser.id,
        inviterName: currentUser.name,
        inviterEmail: currentUser.email,
      })),
      
      // Recently created organizations (active)
      ...recentOrganizations.map(org => ({
        id: `org-created-${org.id}`,
        type: 'organization_created',
        email: org.adminUserEmail || 'N/A',
        name: org.adminUserName || 'Unknown Admin',
        role: 'admin',
        status: org.isActive ? 'active' : 'pending',
        organizationName: org.name,
        organizationCode: org.code,
        invitedAt: org.createdAt?.toISOString(),
        expiresAt: null,
        invitedBy: currentUser.id,
        inviterName: currentUser.name,
        inviterEmail: currentUser.email,
      })),
      
      // BDI user invitations (pending)
      ...pendingUserInvitations.map(invitation => ({
        id: `user-invite-${invitation.id}`,
        type: 'user_invitation',
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        status: 'pending',
        organizationName: 'Boundless Devices Inc',
        organizationCode: 'BDI',
        invitedAt: invitation.invitedAt.toISOString(),
        expiresAt: invitation.resetTokenExpiry?.toISOString(),
        invitedBy: currentUser.id,
        inviterName: currentUser.name,
        inviterEmail: currentUser.email,
        title: invitation.title,
        department: invitation.department,
      })),
    ];

    // Sort all activities by creation date (most recent first)
    activities.sort((a, b) => new Date(b.invitedAt || 0).getTime() - new Date(a.invitedAt || 0).getTime());

    return NextResponse.json(activities);
    
  } catch (error) {
    console.error('Error fetching pending invitations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
