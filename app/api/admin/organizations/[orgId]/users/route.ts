import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers, organizationInvitations } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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
      // Get organization info for the existing user
      const [existingUserOrg] = await db
        .select({
          orgCode: organizations.code,
          orgName: organizations.name,
        })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizationMembers.organizationUuid, organizations.id))
        .where(eq(organizationMembers.userAuthId, existingUser.authId))
        .limit(1);

      return NextResponse.json(
        { 
          error: 'user_exists',
          message: `A user with email ${email} already exists`,
          existingUser: {
            id: existingUser.id,
            authId: existingUser.authId,
            email: existingUser.email,
            name: existingUser.name,
            role: existingUser.role,
            isActive: existingUser.isActive,
            passwordHash: existingUser.passwordHash,
            organization: existingUserOrg ? {
              code: existingUserOrg.orgCode,
              name: existingUserOrg.orgName
            } : null
          }
        },
        { status: 409 } // 409 Conflict - more appropriate than 400
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

    // Generate invitation token and send email
    const invitationToken = Buffer.from(
      JSON.stringify({
        organizationId: targetOrganization.id,
        organizationName: targetOrganization.name,
        adminEmail: email,
        role: role,
        timestamp: Date.now()
      })
    ).toString('base64url');

    const inviteUrl = `https://www.bdibusinessportal.com/sign-up?token=${invitationToken}`;
    
    console.log('📧 EMAIL PROCESS - Invitation URL generated:', inviteUrl);
    console.log('📧 EMAIL PROCESS - Resend configured:', !!resend);
    console.log('📧 EMAIL PROCESS - RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
    console.log('📧 EMAIL PROCESS - Environment:', process.env.NODE_ENV || 'development');
    
    // Send invitation email
    if (resend) {
      try {
        console.log('📧 EMAIL PROCESS - Attempting to send email to:', email);
        console.log('📧 EMAIL PROCESS - Email subject:', `Invitation to join ${targetOrganization.name} on BDI Business Portal`);
        
        const { data, error } = await resend.emails.send({
          from: 'BDI Business Portal <noreply@bdibusinessportal.com>',
          to: [email],
          subject: `Invitation to join ${targetOrganization.name} on BDI Business Portal`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
              <!-- Header -->
              <div style="text-align: center; margin-bottom: 30px; background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h1 style="color: #1D897A; font-size: 32px; margin: 0; font-weight: bold;">BDI Business Portal</h1>
                <p style="color: #1F295A; font-size: 18px; margin: 10px 0 0 0; font-weight: 500;">Boundless Devices Inc</p>
                <div style="width: 80px; height: 4px; background: linear-gradient(135deg, #1D897A, #6BC06F); margin: 15px auto 0 auto; border-radius: 2px;"></div>
              </div>

              <!-- Main Content -->
              <div style="background-color: white; padding: 40px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h2 style="color: #1F295A; margin-bottom: 20px; font-size: 24px;">You're invited to join ${targetOrganization.name}!</h2>
                
                <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                  You've been invited to join <strong>${targetOrganization.name}</strong> on the BDI Business Portal. 
                  Click the button below to create your account and get started with our CPFR supply chain management platform.
                </p>

                <div style="text-align: center; margin: 35px 0;">
                  <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #1D897A, #6BC06F); color: white; text-decoration: none; padding: 15px 35px; border-radius: 25px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(29, 137, 122, 0.3);">
                    Join ${targetOrganization.name}
                  </a>
                </div>

                <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 25px 0 0 0; text-align: center;">
                  This invitation will expire in 7 days. If you have any questions, please contact your organization administrator.
                </p>
              </div>

              <!-- Footer -->
              <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
                <p style="margin: 0;">© 2025 Boundless Devices Inc. All rights reserved.</p>
                <p style="margin: 5px 0 0 0;">BDI Business Portal - B2B Data Exchange & Collaboration Platform</p>
              </div>
            </div>
          `,
        });

        if (error) {
          console.error('📧 EMAIL PROCESS - ❌ Resend API error:', error);
          console.error('📧 EMAIL PROCESS - Error details:', JSON.stringify(error));
          console.error('📧 EMAIL PROCESS - Error type:', error?.name);
          console.error('📧 EMAIL PROCESS - Error message:', error?.message);
        } else {
          console.log('📧 EMAIL PROCESS - ✅ Email sent successfully!');
          console.log('📧 EMAIL PROCESS - Resend response data:', data);
          console.log('📧 EMAIL PROCESS - Email ID:', data?.id);
          console.log('📧 EMAIL PROCESS - Recipient:', email);
        }
      } catch (emailError) {
        console.error('📧 EMAIL PROCESS - ❌ Email sending exception:', emailError);
        console.error('📧 EMAIL PROCESS - Exception type:', typeof emailError);
        console.error('📧 EMAIL PROCESS - Exception message:', emailError instanceof Error ? emailError.message : 'Unknown');
        // Don't fail the whole operation if email fails
      }
    } else {
      console.log('📧 EMAIL PROCESS - ❌ Resend not configured');
      console.log('📧 EMAIL PROCESS - RESEND_API_KEY missing in environment');
      console.log('📧 EMAIL PROCESS - Invitation URL (not emailed):', inviteUrl);
    }
    
    console.log(`Super Admin created user ${email} for organization ${targetOrganization.code}`);
    
    return NextResponse.json({
      success: true,
      message: resend ? 'User added and invitation email sent successfully' : 'User added successfully (email not configured)',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        title: newUser.title,
        department: newUser.department,
        isActive: newUser.isActive,
      },
      invitationToken,
      inviteUrl: resend ? 'Email sent' : inviteUrl,
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
