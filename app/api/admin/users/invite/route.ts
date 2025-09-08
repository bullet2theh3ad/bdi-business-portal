import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
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

const inviteUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  role: z.enum(['admin', 'developer', 'member']),
  title: z.string().min(1).max(100),
  department: z.enum(['Executive', 'Engineering', 'Operations', 'Sales', 'Finance', 'Marketing']),
});

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || !['super_admin', 'admin'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = inviteUserSchema.parse(body);

    // Check role permissions - Admin can only invite members and developers
    if (currentUser.role === 'admin' && ['admin'].includes(validatedData.role)) {
      return NextResponse.json(
        { error: 'Admins can only invite members and developers, not other admins' }, 
        { status: 403 }
      );
    }

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' }, 
        { status: 400 }
      );
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

    // Create pending user record first
    const [newUser] = await db
      .insert(users)
      .values({
        authId: crypto.randomUUID(), // Temporary - will be updated when they sign up
        name: validatedData.name,
        email: validatedData.email,
        role: validatedData.role,
        title: validatedData.title,
        department: validatedData.department,
        passwordHash: 'invitation_pending',
        isActive: false, // Will be activated when they accept invitation
        resetToken: crypto.randomUUID(), // Temporary placeholder
        resetTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .returning();

    // Generate invitation token with organization info (Base64URL JSON format)
    const invitationToken = Buffer.from(
      JSON.stringify({
        organizationId: bdiOrg.id,
        organizationName: bdiOrg.name,
        adminEmail: validatedData.email,
        role: validatedData.role,
        timestamp: Date.now()
      })
    ).toString('base64url');

    // Add user to BDI organization
    await db
      .insert(organizationMembers)
      .values({
        userAuthId: newUser.authId,
        organizationUuid: bdiOrg.id,
        role: validatedData.role,
      });

    // Send invitation email using Resend (like WHEELS system)
    const inviteUrl = `https://www.bdibusinessportal.com/sign-up?token=${invitationToken}`;
    
    if (resend) {
      try {
        console.log('Sending BDI invitation email to:', validatedData.email);
        
        const { data, error } = await resend.emails.send({
          from: 'BDI Business Portal <noreply@bdibusinessportal.com>',
          to: [validatedData.email],
          subject: `Invitation to join BDI Business Portal`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #1D897A; font-size: 28px; margin: 0; font-weight: bold;">
                  BDI Business Portal
                </h1>
                <p style="color: #1F295A; font-size: 16px; margin: 5px 0 0 0; font-weight: 500;">
                  Boundless Devices Inc
                </p>
                <div style="width: 60px; height: 3px; background: linear-gradient(135deg, #1D897A, #6BC06F); margin: 10px auto 0 auto; border-radius: 2px;"></div>
              </div>
              
              <h2 style="color: #1F295A; margin-bottom: 20px;">You're invited to join Boundless Devices Inc!</h2>
              
              <p style="color: #6b7280; font-size: 16px; margin-bottom: 15px;">
                Hi ${validatedData.name},
              </p>
              
              <p style="color: #6b7280; font-size: 16px; margin-bottom: 25px;">
                <strong>${currentUser.name}</strong> has invited you to join the <strong>BDI Business Portal</strong> as a <strong>${validatedData.role.replace('_', ' ')}</strong>.
              </p>
              
              <div style="background: linear-gradient(135deg, #1D897A, #6BC06F); padding: 25px; border-radius: 12px; margin: 25px 0; color: white;">
                <p style="margin: 0; font-size: 16px;">
                  🎯 <strong>Your Role:</strong> ${validatedData.title} - ${validatedData.department}<br><br>
                  📊 <strong>Access Level:</strong> ${validatedData.role.replace('_', ' ').toUpperCase()}<br><br>
                  🏢 <strong>Organization:</strong> Boundless Devices Inc<br><br>
                  🔗 <strong>Platform:</strong> CPFR Supply Chain Management Portal
                </p>
              </div>
              
              <div style="text-align: center; margin: 35px 0;">
                <a href="${inviteUrl}" 
                   style="background: linear-gradient(135deg, #1D897A, #6BC06F); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(29, 137, 122, 0.3);">
                  Accept Invitation & Set Password
                </a>
              </div>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h3 style="color: #1F295A; margin-top: 0;">What is BDI Business Portal?</h3>
                <p style="color: #6b7280; margin: 0; font-size: 14px;">
                  🔄 <strong>CPFR Management:</strong> Collaborative Planning, Forecasting & Replenishment<br>
                  📦 <strong>Supply Chain:</strong> Monitor inventory, sites, and supply signals<br>
                  🤝 <strong>B2B Integration:</strong> API access and data exchange with partners<br>
                  📊 <strong>Analytics:</strong> Real-time insights and reporting
                </p>
              </div>
              
              <p style="color: #9ca3af; font-size: 14px; margin-bottom: 10px;">
                If you can't click the button, copy and paste this link into your browser:<br>
                <a href="${inviteUrl}" style="color: #1D897A; word-break: break-all;">${inviteUrl}</a>
              </p>
              
              <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
                This invitation will expire in 7 days. If you have any questions, please contact ${currentUser.email}.<br><br>
                <strong>Boundless Devices Inc</strong> - Proprietary & Confidential
              </p>
            </div>
          `,
        });

        if (error) {
          console.error('❌ Resend email failed:', error);
        } else {
          console.log('✅ BDI invitation email sent successfully to:', validatedData.email);
          console.log('Email ID:', data?.id);
        }
      } catch (emailError) {
        console.error('Error sending Resend email:', emailError);
      }
    } else {
      console.log('❌ Resend API key not configured');
    }

    return NextResponse.json({
      success: true,
      message: resend ? 'User invitation sent successfully' : 'User created successfully (email not configured)',
      inviteUrl: inviteUrl, // Always provide invite URL for debugging
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        title: newUser.title,
        department: newUser.department,
      }
    });
    
  } catch (error) {
    console.error('Error sending user invitation:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data provided', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const currentUser = await getCurrentUser();
    
    if (!currentUser || !['super_admin', 'admin'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Prevent self-deletion
    if (currentUser.authId === userId) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' }, 
        { status: 403 }
      );
    }

    // Soft delete user
    const [deactivatedUser] = await db
      .update(users)
      .set({
        isActive: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.authId, userId))
      .returning();

    if (!deactivatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'User deactivated successfully'
    });
    
  } catch (error) {
    console.error('Error deactivating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
