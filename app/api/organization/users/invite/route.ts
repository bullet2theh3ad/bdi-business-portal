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

    const body = await request.json();
    console.log('Received user invitation request:', body);
    
    const validatedData = inviteUserSchema.parse(body);
    console.log('Validated user invitation data:', validatedData);

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    console.log('Creating user for organization:', userOrganization.name);

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

    console.log('Created user:', newUser);

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
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-up?token=${invitationToken}`;
    
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
    console.error('Error creating user invitation:', error);
    
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.errors);
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
