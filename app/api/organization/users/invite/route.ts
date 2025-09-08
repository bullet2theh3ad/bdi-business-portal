import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { organizations, users, organizationMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { Resend } from 'resend';
import { z } from 'zod';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Validation schema for organization user invitation
const inviteUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  role: z.enum(['admin', 'member']),
  title: z.string().optional(),
  department: z.string().optional(),
});

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
    console.log('🔍 INVITE DEBUG - Starting user invitation process');
    
    const currentUser = await getCurrentUser();
    console.log('🔍 INVITE DEBUG - Current user:', currentUser ? {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
      authId: currentUser.authId
    } : 'null');
    
    if (!currentUser || !['admin', 'super_admin'].includes(currentUser.role)) {
      console.log('🔍 INVITE DEBUG - Authorization failed - role:', currentUser?.role);
      return NextResponse.json({ error: 'Unauthorized - Organization Admin or Super Admin required' }, { status: 401 });
    }
    
    console.log('🔍 INVITE DEBUG - Authorization passed');

    // Get the user's organization
    console.log('🔍 INVITE DEBUG - Looking up user organization for authId:', currentUser.authId);
    
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

    console.log('🔍 INVITE DEBUG - User organization membership:', userOrgMembership);

    if (!userOrgMembership) {
      console.log('🔍 INVITE DEBUG - No organization membership found');
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 403 });
    }

    const userOrganization = userOrgMembership.organization;
    console.log('🔍 INVITE DEBUG - User organization:', userOrganization);

    const body = await request.json();
    console.log('🔍 INVITE DEBUG - Request body received:', body);
    
    const validatedData = inviteUserSchema.parse(body);
    console.log('🔍 INVITE DEBUG - Validation passed:', validatedData);

    // Check if user already exists
    console.log('🔍 INVITE DEBUG - Checking if user exists:', validatedData.email);
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    console.log('🔍 INVITE DEBUG - Existing user check result:', existingUser);

    if (existingUser.length > 0) {
      console.log('🔍 INVITE DEBUG - User already exists, returning error');
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    console.log('🔍 INVITE DEBUG - Creating user for organization:', userOrganization.name);
    console.log('🔍 INVITE DEBUG - User data to insert:', {
      name: validatedData.name,
      email: validatedData.email,
      role: validatedData.role,
      title: validatedData.title,
      department: validatedData.department,
    });

    // Create the user (pending state)
    const [newUser] = await db
      .insert(users)
      .values({
        name: validatedData.name,
        email: validatedData.email,
        passwordHash: 'invitation_pending', // Special marker for pending invitations
        role: validatedData.role,
        title: validatedData.title,
        department: validatedData.department,
        authId: crypto.randomUUID(), // Generate a temporary UUID for now
        isActive: false, // Will be activated when they complete signup
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log('🔍 INVITE DEBUG - User created successfully:', newUser);

    // Create organization membership
    await db
      .insert(organizationMembers)
      .values({
        organizationUuid: userOrganization.id,
        userAuthId: newUser.authId,
        role: validatedData.role,
        joinedAt: new Date(),
      });

    console.log('Created organization membership');

    // Generate invitation token
    const invitationToken = Buffer.from(
      JSON.stringify({
        organizationId: userOrganization.id,
        organizationName: userOrganization.name,
        adminEmail: validatedData.email,
        role: validatedData.role,
        timestamp: Date.now()
      })
    ).toString('base64url');

    // Send invitation email
    const inviteUrl = `https://www.bdibusinessportal.com/sign-up?token=${invitationToken}`;
    
    if (resend) {
      try {
        const { data, error } = await resend.emails.send({
          from: 'BDI Business Portal <noreply@bdibusinessportal.com>',
          to: [validatedData.email],
          subject: `Invitation to join ${userOrganization.name} on BDI Business Portal`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
              <!-- Header -->
              <div style="text-align: center; margin-bottom: 30px; background-color: white; padding: 30px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h1 style="color: #1D897A; font-size: 32px; margin: 0; font-weight: bold;">BDI Business Portal</h1>
                <p style="color: #1F295A; font-size: 18px; margin: 10px 0 0 0; font-weight: 500;">Boundless Devices Inc</p>
                <div style="width: 80px; height: 4px; background: linear-gradient(135deg, #1D897A, #6BC06F); margin: 15px auto 0 auto; border-radius: 2px;"></div>
              </div>

              <!-- Main Content -->
              <div style="background-color: white; padding: 40px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px;">
                <h2 style="color: #1F295A; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">You're Invited to Join ${userOrganization.name}</h2>
                
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                  Hello <strong>${validatedData.name}</strong>,
                </p>
                
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                  You've been invited to join <strong>${userOrganization.name}</strong> as a <strong>${validatedData.role}</strong> on the BDI Business Portal. 
                  You'll have access to collaborative tools and data exchange capabilities.
                </p>

                <!-- Organization Details -->
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #1D897A;">
                  <h3 style="color: #1F295A; font-size: 18px; margin: 0 0 15px 0; font-weight: 600;">Your Role Details</h3>
                  <div style="color: #374151; font-size: 14px; line-height: 1.5;">
                    <p style="margin: 5px 0;"><strong>Organization:</strong> ${userOrganization.name}</p>
                    <p style="margin: 5px 0;"><strong>Role:</strong> ${validatedData.role.charAt(0).toUpperCase() + validatedData.role.slice(1)}</p>
                    ${validatedData.title ? `<p style="margin: 5px 0;"><strong>Title:</strong> ${validatedData.title}</p>` : ''}
                    ${validatedData.department ? `<p style="margin: 5px 0;"><strong>Department:</strong> ${validatedData.department}</p>` : ''}
                  </div>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #1D897A, #6BC06F); color: white; text-decoration: none; padding: 15px 35px; border-radius: 25px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(29, 137, 122, 0.3);">
                    Join ${userOrganization.name}
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
          console.error('Resend error:', error);
        } else {
          console.log('User invitation email sent successfully:', data);
        }
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Don't fail the whole operation if email fails
      }
    } else {
      console.log('Resend not configured. Invitation URL:', inviteUrl);
    }

    return NextResponse.json({
      success: true,
      user: { id: newUser.id, email: newUser.email, name: newUser.name },
      invitationToken,
      inviteUrl: resend ? 'Email sent' : inviteUrl
    });

  } catch (error) {
    console.error('🔍 INVITE DEBUG - CATCH BLOCK - Error creating user invitation:', error);
    console.error('🔍 INVITE DEBUG - Error type:', typeof error);
    console.error('🔍 INVITE DEBUG - Error constructor:', error?.constructor?.name);
    console.error('🔍 INVITE DEBUG - Error message:', error instanceof Error ? error.message : 'Not an Error object');
    console.error('🔍 INVITE DEBUG - Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    if (error instanceof z.ZodError) {
      console.error('🔍 INVITE DEBUG - Zod validation errors:', error.errors);
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('🔍 INVITE DEBUG - Returning error response:', errorMessage);
    
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage, debugInfo: `Failed to add ${(error as any)?.email || 'unknown email'}` },
      { status: 500 }
    );
  }
}
