import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

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

    // Get BDI organization
    const [bdiOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.code, 'BDI'))
      .limit(1);

    if (!bdiOrg) {
      return NextResponse.json({ error: 'BDI organization not found' }, { status: 404 });
    }

    // Get all pending BDI user invitations (users who haven't activated yet)
    const pendingInvitations = await db
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
          eq(organizationMembers.organizationUuid, bdiOrg.id),
          eq(users.isActive, false), // Not yet activated
          eq(users.passwordHash, 'invitation_pending'), // Pending invitation
          isNull(users.deletedAt)
        )
      )
      .orderBy(users.createdAt);

    // Format for the component
    const formattedInvitations = pendingInvitations.map(invitation => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: 'pending',
      invitedAt: invitation.invitedAt.toISOString(),
      invitedBy: currentUser.id,
      inviterName: currentUser.name,
      inviterEmail: currentUser.email,
      name: invitation.name,
      title: invitation.title,
      department: invitation.department,
      expiresAt: invitation.resetTokenExpiry?.toISOString(),
    }));

    return NextResponse.json(formattedInvitations);
    
  } catch (error) {
    console.error('Error fetching pending invitations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
