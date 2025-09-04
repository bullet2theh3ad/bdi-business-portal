import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db/drizzle';
import { organizations, users, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { Resend } from 'resend';

// Create Supabase clients
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Validation schema for adding organization
const addOrganizationSchema = {
  companyName: (val: string) => val && val.trim().length > 0,
  organizationCode: (val: string) => val && val.trim().length >= 2 && val.trim().length <= 10,
  organizationType: (val: string) => ['contractor', 'shipping_logistics', 'oem_partner', 'rd_partner', 'distributor', 'retail_partner', 'threpl_partner'].includes(val),
  adminName: (val: string) => val && val.trim().length > 0,
  adminEmail: (val: string) => val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
  capabilities: (val: string[]) => Array.isArray(val) && val.length > 0,
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database to check role
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, user.id))
      .limit(1);

    if (!dbUser || dbUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate required fields
    const validatedData = {
      companyName: body.companyName?.trim(),
      organizationCode: body.organizationCode?.trim().toUpperCase(),
      organizationType: body.organizationType,
      adminName: body.adminName?.trim(),
      adminEmail: body.adminEmail?.trim().toLowerCase(),
      capabilities: body.capabilities || [],
      description: body.description?.trim() || ''
    };

    // Check validation
    for (const [field, validator] of Object.entries(addOrganizationSchema)) {
      if (!validator(validatedData[field as keyof typeof validatedData] as any)) {
        return NextResponse.json(
          { error: `Invalid or missing field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Check if organization code already exists
    const existingOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.code, validatedData.organizationCode))
      .limit(1);

    if (existingOrg.length > 0) {
      return NextResponse.json(
        { error: `Organization code "${validatedData.organizationCode}" already exists` },
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

    // Use the admin client for creating users without email confirmation
    
    // Create the organization (immediately active)
    console.log('Creating organization with data:', {
      name: validatedData.companyName,
      code: validatedData.organizationCode,
      type: validatedData.organizationType,
      isActive: true, // Immediately active - no invitation needed
    });

    const [newOrganization] = await db
      .insert(organizations)
      .values({
        name: validatedData.companyName,
        code: validatedData.organizationCode,
        type: validatedData.organizationType,
        isActive: true, // Immediately active
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log('Created organization:', newOrganization);

    // Generate a secure temporary password
    const tempPassword = `BDI${Math.random().toString(36).substring(2, 8).toUpperCase()}!`;
    
    // Create Supabase auth user with email confirmation already done
    console.log('Creating Supabase auth user for:', validatedData.adminEmail);
    
    const { data: supabaseUser, error: supabaseError } = await supabaseAdmin.auth.admin.createUser({
      email: validatedData.adminEmail,
      password: tempPassword,
      email_confirm: true, // Skip email confirmation - user can login immediately
      user_metadata: {
        name: validatedData.adminName,
        direct_creation: true, // Mark as direct creation (not invitation)
        organization_id: newOrganization.id,
        organization_name: validatedData.companyName
      }
    });

    if (supabaseError || !supabaseUser.user) {
      console.error('Supabase user creation error:', supabaseError);
      // Clean up the organization if user creation fails
      await db.delete(organizations).where(eq(organizations.id, newOrganization.id));
      return NextResponse.json(
        { error: `Failed to create admin user: ${supabaseError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    console.log('Created Supabase user:', supabaseUser.user.id);

    // Create database user record (immediately active)
    const [newUser] = await db
      .insert(users)
      .values({
        authId: supabaseUser.user.id,
        email: supabaseUser.user.email!,
        name: validatedData.adminName,
        role: 'admin', // Organization admin
        passwordHash: 'supabase_managed',
        isActive: true, // Immediately active
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log('Created database user:', newUser.email);

    // Create organization membership
    await db
      .insert(organizationMembers)
      .values({
        userAuthId: supabaseUser.user.id,
        organizationUuid: newOrganization.id,
        role: 'admin',
        joinedAt: new Date(),
      });

    console.log('Created organization membership');

    // Send welcome email with login credentials
    if (resend) {
      try {
        await resend.emails.send({
          from: 'BDI Business Portal <noreply@boundlessdevices.com>',
          to: [validatedData.adminEmail],
          subject: `Welcome to BDI Business Portal - ${validatedData.companyName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Welcome to BDI Business Portal</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Welcome to BDI Business Portal</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your organization has been created successfully</p>
              </div>
              
              <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                <p style="font-size: 18px; margin-bottom: 20px;">Hello <strong>${validatedData.adminName}</strong>,</p>
                
                <p>Your organization <strong>${validatedData.companyName}</strong> has been successfully created in the BDI Business Portal. You now have immediate access to the platform with administrator privileges.</p>
                
                <div style="background: white; border: 2px solid #28a745; border-radius: 8px; padding: 20px; margin: 20px 0;">
                  <h3 style="color: #28a745; margin-top: 0;">🔑 Your Login Credentials</h3>
                  <p><strong>Email:</strong> ${validatedData.adminEmail}</p>
                  <p><strong>Temporary Password:</strong> <code style="background: #f1f3f4; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 16px;">${tempPassword}</code></p>
                  <p><strong>Organization Code:</strong> <code style="background: #f1f3f4; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${validatedData.organizationCode}</code></p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-in" 
                     style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                    Login to Portal
                  </a>
                </div>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
                  <h4 style="color: #856404; margin-top: 0;">🔒 Important Security Notice</h4>
                  <p style="margin-bottom: 0; color: #856404;">Please change your password immediately after logging in. Go to your profile settings to update your password and complete your account setup.</p>
                </div>
                
                <h3>🚀 What's Next?</h3>
                <ul>
                  <li>Login with your credentials above</li>
                  <li>Change your temporary password</li>
                  <li>Complete your organization profile</li>
                  <li>Invite team members to join your organization</li>
                  <li>Explore the available features and capabilities</li>
                </ul>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; text-align: center; color: #6c757d; font-size: 14px;">
                  <p>If you have any questions or need assistance, please contact our support team.</p>
                  <p><strong>BDI Business Portal</strong><br>
                  Boundless Devices Inc<br>
                  <a href="mailto:support@boundlessdevices.com" style="color: #007bff;">support@boundlessdevices.com</a></p>
                </div>
              </div>
            </body>
            </html>
          `,
        });

        console.log('Welcome email sent to:', validatedData.adminEmail);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail the entire operation if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Organization created successfully',
      organization: {
        id: newOrganization.id,
        name: newOrganization.name,
        code: newOrganization.code,
        type: newOrganization.type,
        isActive: newOrganization.isActive,
      },
      admin: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
      loginInfo: {
        email: validatedData.adminEmail,
        tempPassword: tempPassword, // Include in response for Super Admin reference
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-in`
      }
    });
    
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
