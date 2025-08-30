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

    // Send invitation email using Supabase Auth
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign-up?token=${invitationToken}`;
    
    try {
      // Create admin client with service role key for admin operations
      const supabaseAdmin = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key required for admin operations
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
      
      // Use Supabase Auth to send invitation email
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(validatedData.email, {
        redirectTo: inviteUrl,
        data: {
          name: validatedData.name,
          role: validatedData.role,
          title: validatedData.title,
          department: validatedData.department,
          invited_by: currentUser.name,
          organization: 'Boundless Devices Inc'
        }
      });

      if (error) {
        console.error('Error sending Supabase invitation:', error);
        console.error('Supabase error details:', error.message, error.status);
        // Continue anyway - user was created, just email failed
      } else {
        console.log('Supabase invitation sent successfully to:', validatedData.email);
        console.log('Invitation data:', data);
      }
    } catch (emailError) {
      console.error('Error sending invitation email:', emailError);
      // Continue anyway - user was created, just email failed
    }

    return NextResponse.json({
      success: true,
      message: resend ? 'User invitation sent successfully' : 'User created successfully (email not configured)',
      inviteUrl: resend ? undefined : inviteUrl, // Provide invite URL if email not sent
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
