import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers, organizationInvitations } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import crypto from 'crypto';

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
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  if (!authUser) return null;
  
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.authId, authUser.id))
    .limit(1);

  return dbUser;
}

// GET - Fetch users for a specific organization (Super Admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized - Super Admin required' }, { status: 401 });
    }

    const { orgId } = await params;
    
    // Get the target organization
    const [targetOrganization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!targetOrganization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    console.log('Super Admin fetching users for organization:', targetOrganization.name, targetOrganization.code);

    // Get all users from the target organization
    const organizationUsers = await db
      .select({
        id: users.id,
        authId: users.authId,
        name: users.name,
        email: users.email,
        role: users.role,
        title: users.title,
        department: users.department,
        phone: users.phone,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        membershipRole: organizationMembers.role,
        // Organization info
        organization: {
          id: organizations.id,
          name: organizations.name,
          code: organizations.code,
          type: organizations.type,
        }
      })
      .from(users)
      .innerJoin(organizationMembers, eq(users.authId, organizationMembers.userAuthId))
      .innerJoin(organizations, eq(organizationMembers.organizationUuid, organizations.id))
      .where(
        and(
          eq(organizationMembers.organizationUuid, targetOrganization.id),
          isNull(users.deletedAt)
        )
      )
      .orderBy(users.createdAt);

    // Also get pending organization invitations for this organization
    const pendingInvitations = await db
      .select({
        id: organizationInvitations.id,
        invitationToken: organizationInvitations.invitationToken,
        invitedEmail: organizationInvitations.invitedEmail,
        invitedName: organizationInvitations.invitedName,
        invitedRole: organizationInvitations.invitedRole,
        status: organizationInvitations.status,
        createdAt: organizationInvitations.createdAt,
        expiresAt: organizationInvitations.expiresAt,
        acceptedAt: organizationInvitations.acceptedAt,
        // Tracking fields
        senderDomain: organizationInvitations.senderDomain,
        emailDeliveryStatus: organizationInvitations.emailDeliveryStatus,
        sentByUserType: organizationInvitations.sentByUserType,
      })
      .from(organizationInvitations)
      .where(eq(organizationInvitations.organizationId, targetOrganization.id))
      .orderBy(organizationInvitations.createdAt);

    console.log(`Found ${organizationUsers.length} users and ${pendingInvitations.length} pending invitations in organization ${targetOrganization.code}`);

    return NextResponse.json({
      organization: {
        id: targetOrganization.id,
        name: targetOrganization.name,
        code: targetOrganization.code,
        type: targetOrganization.type,
        isActive: targetOrganization.isActive,
      },
      users: organizationUsers,
      pendingInvitations: pendingInvitations,
      totalUsers: organizationUsers.length,
      totalPendingInvitations: pendingInvitations.length,
      activeUsers: organizationUsers.filter(u => u.isActive).length,
      adminUsers: organizationUsers.filter(u => u.membershipRole === 'admin').length,
    });
    
  } catch (error) {
    console.error('Error fetching organization users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Add new user to specific organization (Super Admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized - Super Admin required' }, { status: 401 });
    }

    const { orgId } = await params;
    const body = await request.json();
    
    // Validate required fields
    const { name, email, role, title, department } = body;
    
    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, role' },
        { status: 400 }
      );
    }

    // Get the target organization
    const [targetOrganization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!targetOrganization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    // Create user record (pending state - they'll need to complete signup)
    const [newUser] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: 'invitation_pending', // Special marker for pending invitations
        role: role,
        title: title?.trim(),
        department: department?.trim(),
        authId: crypto.randomUUID(), // Generate a temporary UUID for now
        isActive: false, // Will be activated when they complete signup
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create organization membership
    await db
      .insert(organizationMembers)
      .values({
        organizationUuid: targetOrganization.id,
        userAuthId: newUser.authId,
        role: role,
        joinedAt: new Date(),
      });

    // TODO: Send invitation email to the new user
    // For now, return success with user details
    
    console.log(`Super Admin created user ${email} for organization ${targetOrganization.code}`);
    
    return NextResponse.json({
      success: true,
      message: 'User added to organization successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        title: newUser.title,
        department: newUser.department,
        isActive: newUser.isActive,
      },
      organization: {
        id: targetOrganization.id,
        name: targetOrganization.name,
        code: targetOrganization.code,
      }
    });
    
  } catch (error) {
    console.error('Error adding user to organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update user details (Super Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized - Super Admin required' }, { status: 401 });
    }

    const { orgId } = await params;
    const body = await request.json();
    const { userId, name, email, role, title, department, phone, isActive } = body;
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Get the target organization
    const [targetOrganization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!targetOrganization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get the user to update
    const [userToUpdate] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userToUpdate) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user belongs to the target organization
    const [userMembership] = await db
      .select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userAuthId, userToUpdate.authId),
        eq(organizationMembers.organizationUuid, targetOrganization.id)
      ))
      .limit(1);

    if (!userMembership) {
      return NextResponse.json({ error: 'User does not belong to this organization' }, { status: 403 });
    }

    // Update user details
    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email.trim().toLowerCase();
    if (title !== undefined) updateData.title = title?.trim();
    if (department !== undefined) updateData.department = department?.trim();
    if (phone !== undefined) updateData.phone = phone?.trim();
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    // Update organization membership role if provided
    if (role !== undefined) {
      await db
        .update(organizationMembers)
        .set({ role: role })
        .where(and(
          eq(organizationMembers.userAuthId, userToUpdate.authId),
          eq(organizationMembers.organizationUuid, targetOrganization.id)
        ));
    }

    console.log(`Super Admin updated user ${updatedUser.email} in organization ${targetOrganization.code}`);
    
    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: role || userMembership.role,
        title: updatedUser.title,
        department: updatedUser.department,
        phone: updatedUser.phone,
        isActive: updatedUser.isActive,
      }
    });
    
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
