import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { organizations, users, organizationMembers } from '@/lib/db/schema';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { Resend } from 'resend';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Validation schema for organization admin user invitation
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
    .where(eq(users.authId, authUser.id))
    .limit(1);

  return dbUser;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 ORG ADMIN INVITE - Starting organization admin invitation process');
    
    const currentUser = await getCurrentUser();
    console.log('🔍 ORG ADMIN INVITE - Current user:', currentUser ? {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
      authId: currentUser.authId
    } : 'null');
    
    // Allow organization admins (not just super_admin)
    if (!currentUser || !['admin', 'super_admin'].includes(currentUser.role)) {
      console.log('🔍 ORG ADMIN INVITE - Authorization failed - role:', currentUser?.role);
      return NextResponse.json({ error: 'Unauthorized - Organization Admin required' }, { status: 401 });
    }
    
    console.log('🔍 ORG ADMIN INVITE - Authorization passed');

    // Get the user's organization
    console.log('🔍 ORG ADMIN INVITE - Looking up user organization for authId:', currentUser.authId);
    
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

    console.log('🔍 ORG ADMIN INVITE - User organization membership:', userOrgMembership);

    if (!userOrgMembership) {
      console.log('🔍 ORG ADMIN INVITE - No organization membership found');
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 403 });
    }

    const userOrganization = userOrgMembership.organization;
    console.log('🔍 ORG ADMIN INVITE - User organization:', userOrganization);

    const body = await request.json();
    console.log('🔍 ORG ADMIN INVITE - Request body received:', body);
    
    const validatedData = inviteUserSchema.parse(body);
    console.log('🔍 ORG ADMIN INVITE - Validation passed:', validatedData);

    // Check if user already exists
    console.log('🔍 ORG ADMIN INVITE - Checking if user exists:', validatedData.email);
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.email.trim().toLowerCase()))
      .limit(1);

    if (existingUsers.length > 0) {
      console.log('🔍 ORG ADMIN INVITE - User already exists, returning error');
      return NextResponse.json({ 
        error: `User with email ${validatedData.email} already exists in the system` 
      }, { status: 400 });
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(16).toString('hex');
    console.log('🔍 ORG ADMIN INVITE - Generated temp password for:', validatedData.email);

    // Create Supabase auth user with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: supabaseUser, error: supabaseError } = await supabaseAdmin.auth.admin.createUser({
      email: validatedData.email.trim().toLowerCase(),
      password: tempPassword,
      email_confirm: true, // Skip email confirmation - user can login immediately
      user_metadata: {
        name: validatedData.name.trim(),
        invitation_signup: true,
        organization_id: userOrganization.id,
        organization_name: userOrganization.name,
        invited_role: validatedData.role
      }
    });

    if (supabaseError || !supabaseUser.user) {
      console.error('🔍 ORG ADMIN INVITE - Failed to create Supabase user:', supabaseError);
      return NextResponse.json(
        { error: `Failed to create user account: ${supabaseError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    console.log('✅ ORG ADMIN INVITE - Created Supabase user:', supabaseUser.user.id);

    // Create user with real Supabase auth ID
    const [newUser] = await db
      .insert(users)
      .values({
        authId: supabaseUser.user.id, // Real Supabase auth ID
        email: validatedData.email.trim().toLowerCase(),
        name: validatedData.name.trim(),
        role: validatedData.role,
        title: validatedData.title?.trim(),
        department: validatedData.department?.trim(),
        supplierCode: userOrganization.code,
        passwordHash: 'supabase_managed', // Managed by Supabase
        isActive: true, // Active immediately
        invitationSenderDomain: 'bdibusinessportal.com',
        invitationDeliveryStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Create organization membership
    await db
      .insert(organizationMembers)
      .values({
        userAuthId: supabaseUser.user.id,
        organizationUuid: userOrganization.id!,
        role: validatedData.role,
        joinedAt: new Date(),
      });

    console.log('✅ ORG ADMIN INVITE - Created user with Supabase auth - ready to login');

    // Send invitation email with login credentials
    console.log('🔍 ORG ADMIN INVITE - EMAIL DEBUG - Resend configured:', !!resend);
    
    if (resend) {
      try {
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: 'BDI Business Portal <noreply@bdibusinessportal.com>',
          to: [validatedData.email.trim().toLowerCase()],
          subject: `Welcome to BDI Business Portal - ${userOrganization.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Welcome to BDI Business Portal!</h2>
              
              <p>Hello ${validatedData.name},</p>
              
              <p>You've been invited to join <strong>${userOrganization.name}</strong> on the BDI Business Portal.</p>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1f2937;">Your Login Credentials:</h3>
                <p><strong>Email:</strong> ${validatedData.email}</p>
                <p><strong>Temporary Password:</strong> <code style="background-color: #e5e7eb; padding: 2px 4px; border-radius: 4px;">${tempPassword}</code></p>
                <p><strong>Login URL:</strong> <a href="https://www.bdibusinessportal.com/sign-in">https://www.bdibusinessportal.com/sign-in</a></p>
              </div>
              
              <p><strong>Important:</strong> Please change your password after your first login for security.</p>
              
              <p>If you have any questions, please contact your organization administrator.</p>
              
              <p>Best regards,<br>BDI Business Portal Team</p>
            </div>
          `
        });

        if (emailError) {
          console.error('🔍 ORG ADMIN INVITE - Failed to send email:', emailError);
          // Don't fail the whole operation - user was created successfully
        } else {
          console.log('✅ ORG ADMIN INVITE - Email sent successfully:', emailData?.id);
        }
      } catch (emailError) {
        console.error('🔍 ORG ADMIN INVITE - Email sending error:', emailError);
        // Don't fail the whole operation - user was created successfully
      }
    } else {
      console.log('⚠️ ORG ADMIN INVITE - Resend not configured, skipping email');
    }

    return NextResponse.json({
      success: true,
      message: `User ${validatedData.name} has been invited to ${userOrganization.name}`,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        title: newUser.title,
        department: newUser.department
      },
      tempPassword: tempPassword, // Include for debugging - remove in production
      loginUrl: 'https://bdibusinessportal.com/sign-in'
    });

  } catch (error) {
    console.error('❌ ORG ADMIN INVITE - Error in invitation process:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
