import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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

    // Generate invitation token
    const invitationToken = crypto.randomUUID();
    
    // Create pending user record
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
        resetToken: invitationToken,
        resetTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .returning();

    // Add user to BDI organization
    await db
      .insert(organizationMembers)
      .values({
        userAuthId: newUser.authId,
        organizationUuid: bdiOrg.id,
        role: validatedData.role,
      });

    // Send invitation email
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-up?token=${invitationToken}`;
    
    try {
      await resend.emails.send({
        from: 'BDI Business Portal <noreply@boundlessdevices.com>',
        to: [validatedData.email],
        subject: `Invitation to join BDI Business Portal`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1D897A; text-align: center;">BDI Business Portal</h1>
            
            <h2 style="color: #374151;">You're invited to join Boundless Devices Inc!</h2>
            
            <p style="color: #6b7280; font-size: 16px;">
              Hi ${validatedData.name},
            </p>
            
            <p style="color: #6b7280; font-size: 16px;">
              <strong>${currentUser.name}</strong> has invited you to join <strong>BDI Business Portal</strong> as a <strong>${validatedData.role.replace('_', ' ')}</strong>.
            </p>
            
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #374151; margin: 0;">
                🎯 <strong>Your Role:</strong> ${validatedData.title} - ${validatedData.department}<br>
                📊 <strong>Access Level:</strong> ${validatedData.role.replace('_', ' ').toUpperCase()}<br>
                🏢 <strong>Organization:</strong> Boundless Devices Inc
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" 
                 style="background: #1D897A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Accept Invitation & Set Password
              </a>
            </div>
            
            <p style="color: #9ca3af; font-size: 14px;">
              If you can't click the button, copy and paste this link into your browser:<br>
              <a href="${inviteUrl}" style="color: #1D897A;">${inviteUrl}</a>
            </p>
            
            <p style="color: #9ca3af; font-size: 12px;">
              This invitation will expire in 7 days. If you have any questions, please contact ${currentUser.email}.
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Error sending invitation email:', emailError);
      // Continue anyway - user was created, just email failed
    }

    return NextResponse.json({
      success: true,
      message: 'User invitation sent successfully',
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
