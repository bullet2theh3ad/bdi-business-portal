import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { organizations, users, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Resend } from 'resend';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Validation schema for organization invitation
const inviteOrganizationSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  organizationCode: z.string().min(1, 'Organization code is required'),
  organizationType: z.enum(['contractor', 'shipping_logistics', 'oem_partner', 'rd_partner', 'distributor', 'retail_partner', 'threpl_partner']),
  adminName: z.string().min(1, 'Admin name is required'),
  adminEmail: z.string().email('Valid email is required'),
  capabilities: z.array(z.string()).min(1, 'At least one capability must be selected'),
  description: z.string().optional(),
});

export async function POST(request: NextRequest) {
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

    // Create admin client for user creation
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

    const body = await request.json();
    console.log('Received invitation request body:', body);
    
    const validatedData = inviteOrganizationSchema.parse(body);
    console.log('Validated invitation data:', validatedData);

    // Check if organization code already exists
    const existingOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.code, validatedData.organizationCode))
      .limit(1);

    if (existingOrg.length > 0) {
      return NextResponse.json(
        { error: 'Organization code already exists' },
        { status: 400 }
      );
    }

    // Check if admin email already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.adminEmail))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    // Create the organization
    console.log('Creating organization with data:', {
      name: validatedData.companyName,
      code: validatedData.organizationCode,
      type: validatedData.organizationType,
      isActive: false,
    });

    const [newOrganization] = await db
      .insert(organizations)
      .values({
        name: validatedData.companyName,
        code: validatedData.organizationCode,
        type: validatedData.organizationType,
        isActive: false, // Will be activated when admin completes setup
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log('Created organization:', newOrganization);

    // Create Supabase auth user silently (no email sent)
    console.log('Creating Supabase auth user silently for:', validatedData.adminEmail);
    
    // Generate a temporary password that the user will change during signup
    const tempPassword = crypto.randomUUID();
    
    const { data: supabaseUser, error: supabaseError } = await supabaseAdmin.auth.admin.createUser({
      email: validatedData.adminEmail,
      password: tempPassword,
      email_confirm: true, // Skip email confirmation
      user_metadata: {
        name: validatedData.adminName,
        invitation_signup: true,
        organization_id: newOrganization.id,
        organization_name: validatedData.companyName
      }
    });

    if (supabaseError || !supabaseUser.user) {
      console.error('Failed to create Supabase user:', supabaseError);
      // Clean up the organization if user creation failed
      await db.delete(organizations).where(eq(organizations.id, newOrganization.id));
      return NextResponse.json(
        { error: 'Failed to create user account. Please try again.' },
        { status: 500 }
      );
    }

    console.log('✅ Created Supabase user silently:', supabaseUser.user.id);

    // Create the admin user in our database
    console.log('Creating admin user in database with data:', {
      name: validatedData.adminName,
      email: validatedData.adminEmail,
      role: 'admin',
      authId: supabaseUser.user.id,
      isActive: false, // Will be activated when they set their password
    });

    const [newAdminUser] = await db
      .insert(users)
      .values({
        name: validatedData.adminName,
        email: validatedData.adminEmail,
        passwordHash: 'invitation_pending', // Special marker for pending invitations
        role: 'admin',
        authId: supabaseUser.user.id, // Use actual Supabase auth ID
        isActive: false, // Will be activated when they complete signup
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log('Created admin user in database:', newAdminUser);

    // Create organization membership
    console.log('Creating organization membership with data:', {
      organizationUuid: newOrganization.id,
      userAuthId: newAdminUser.authId,
      role: 'admin',
    });

    await db
      .insert(organizationMembers)
      .values({
        organizationUuid: newOrganization.id,
        userAuthId: newAdminUser.authId,
        role: 'admin',
        joinedAt: new Date(),
      });

    console.log('Created organization membership');

    // Generate invitation token with Supabase user ID
    const invitationToken = Buffer.from(
      JSON.stringify({
        organizationId: newOrganization.id,
        organizationName: validatedData.companyName,
        adminEmail: validatedData.adminEmail,
        supabaseUserId: supabaseUser.user.id,
        capabilities: validatedData.capabilities,
        timestamp: Date.now()
      })
    ).toString('base64url');

    // Send invitation email
    const inviteUrl = `https://www.bdibusinessportal.com/sign-up?token=${invitationToken}`;
    
    if (resend) {
      try {
        const capabilityList = validatedData.capabilities
          .map(capId => {
            const capability = [
              { id: 'cpfr', name: 'CPFR Portal' },
              { id: 'inventory', name: 'Inventory Analytics' },
              { id: 'supply_chain', name: 'Supply Chain' },
              { id: 'api_access', name: 'API Access' },
              { id: 'reporting', name: 'Advanced Reporting' },
              { id: 'collaboration', name: 'Team Collaboration' },
              { id: 'document_management', name: 'Document Management' },
            ].find(cap => cap.id === capId);
            return capability ? capability.name : capId;
          })
          .join(', ');

        const { data, error } = await resend.emails.send({
          from: 'BDI Business Portal <noreply@bdibusinessportal.com>',
          to: [validatedData.adminEmail],
          subject: `Invitation to join BDI Business Portal - ${validatedData.companyName}`,
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
                <h2 style="color: #1F295A; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">You're Invited to Join Our B2B Portal</h2>
                
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                  Hello <strong>${validatedData.adminName}</strong>,
                </p>
                
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                  You've been invited to set up <strong>${validatedData.companyName}</strong> as a partner organization in the BDI Business Portal. 
                  As the organization administrator, you'll have access to powerful B2B collaboration tools and data exchange capabilities.
                </p>

                <!-- Organization Details -->
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #1D897A;">
                  <h3 style="color: #1F295A; font-size: 18px; margin: 0 0 15px 0; font-weight: 600;">Organization Details</h3>
                  <div style="color: #374151; font-size: 14px; line-height: 1.5;">
                    <p style="margin: 5px 0;"><strong>Company:</strong> ${validatedData.companyName}</p>
                    <p style="margin: 5px 0;"><strong>Organization Code:</strong> ${validatedData.organizationCode}</p>
                    <p style="margin: 5px 0;"><strong>Type:</strong> ${validatedData.organizationType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                  </div>
                </div>

                <!-- Capabilities -->
                <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #6BC06F;">
                  <h3 style="color: #1F295A; font-size: 18px; margin: 0 0 15px 0; font-weight: 600;">Your Access Capabilities</h3>
                  <p style="color: #374151; font-size: 14px; line-height: 1.5; margin: 0;">
                    <strong>Granted Features:</strong> ${capabilityList}
                  </p>
                </div>

                ${validatedData.description ? `
                <div style="background-color: #fef7ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #1F295A;">
                  <h3 style="color: #1F295A; font-size: 18px; margin: 0 0 15px 0; font-weight: 600;">Partnership Notes</h3>
                  <p style="color: #374151; font-size: 14px; line-height: 1.5; margin: 0;">${validatedData.description}</p>
                </div>
                ` : ''}

                <!-- CTA Button -->
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #1D897A, #6BC06F); color: white; text-decoration: none; padding: 15px 35px; border-radius: 25px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(29, 137, 122, 0.3);">
                    Complete Organization Setup
                  </a>
                </div>

                <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 25px 0 0 0; text-align: center;">
                  This invitation will expire in 7 days. If you have any questions, please contact our support team.
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
          console.log('Invitation email sent successfully:', data);
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
      organization: newOrganization,
      adminUser: { id: newAdminUser.id, email: newAdminUser.email },
      invitationToken,
      inviteUrl: resend ? 'Email sent' : inviteUrl
    });

  } catch (error) {
    console.error('Error creating organization invitation:', error);
    
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
