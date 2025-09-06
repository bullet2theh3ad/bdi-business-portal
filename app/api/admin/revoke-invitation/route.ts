import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizationMembers } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

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

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || !['super_admin', 'admin'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { invitationId } = body;

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID required' }, { status: 400 });
    }

    console.log('Attempting to revoke invitation ID:', invitationId);

    // Check if this is an organization invitation (starts with org-invite-)
    if (invitationId.startsWith('org-invite-')) {
      // This is an organization invitation, handle differently
      const actualToken = invitationId; // The full token is the invitation token
      
      // Delete from organization_invitations table
      const deleteResult = await db
        .execute(sql`DELETE FROM organization_invitations WHERE invitation_token = ${actualToken} RETURNING invited_email`);
      
      if ((deleteResult as any).length === 0) {
        return NextResponse.json({ error: 'Organization invitation not found' }, { status: 404 });
      }
      
      const deletedInvitation = (deleteResult as any)[0];
      
      return NextResponse.json({
        success: true,
        message: `Organization invitation for ${deletedInvitation.invited_email} has been revoked`
      });
    }

    // Handle regular user invitations (existing logic)
    // First, check what user record exists
    const [userToCheck] = await db
      .select()
      .from(users)
      .where(eq(users.id, invitationId))
      .limit(1);

    console.log('Found user record:', userToCheck);

    // Get the pending user to verify it exists
    const [pendingUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, invitationId),
          eq(users.passwordHash, 'invitation_pending'), // Only revoke pending invitations
          eq(users.isActive, false)
        )
      )
      .limit(1);

    console.log('Found pending user:', pendingUser);

    if (!pendingUser) {
      // Try to find any user with this ID (regardless of status)
      const [anyUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, invitationId))
        .limit(1);

      if (anyUser) {
        // Force delete any user with this ID
        console.log('Force deleting user:', anyUser.email);
        
        await db
          .delete(organizationMembers)
          .where(eq(organizationMembers.userAuthId, anyUser.authId));

        await db
          .delete(users)
          .where(eq(users.id, invitationId));

        return NextResponse.json({
          success: true,
          message: `User ${anyUser.email} has been completely removed`
        });
      }

      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Remove organization membership first
    await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.userAuthId, pendingUser.authId));

    // Completely remove the pending user record
    await db
      .delete(users)
      .where(eq(users.id, invitationId));

    return NextResponse.json({
      success: true,
      message: `Invitation for ${pendingUser.email} has been revoked and removed`
    });
    
  } catch (error) {
    console.error('Error revoking invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
