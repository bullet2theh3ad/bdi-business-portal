import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizationMembers, organizations } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';

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

// GET - Fetch all BDI users
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || !['super_admin', 'admin'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Get all BDI users (members of BDI organization)
    const bdiUsers = await db
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
      })
      .from(users)
      .innerJoin(organizationMembers, eq(users.authId, organizationMembers.userAuthId))
      .where(
        and(
          eq(organizationMembers.organizationUuid, bdiOrg.id),
          isNull(users.deletedAt)
        )
      )
      .orderBy(users.createdAt);

    return NextResponse.json(bdiUsers);
    
  } catch (error) {
    console.error('Error fetching BDI users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new BDI user invitation
const createUserSchema = z.object({
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
    const validatedData = createUserSchema.parse(body);

    // Check role permissions
    if (currentUser.role === 'admin' && ['super_admin', 'admin'].includes(validatedData.role)) {
      return NextResponse.json(
        { error: 'Admins can only invite members and developers' }, 
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

    // Create invitation record (we'll implement the invitations table properly)
    // For now, we'll create a placeholder user and send invitation email
    const tempPassword = `temp_${Math.random().toString(36).substring(2, 15)}`;
    
    // Create user record with temporary data
    const [newUser] = await db
      .insert(users)
      .values({
        authId: crypto.randomUUID(), // Temporary - will be updated when they sign up
        name: validatedData.name,
        email: validatedData.email,
        role: validatedData.role,
        title: validatedData.title,
        department: validatedData.department,
        passwordHash: 'invitation_pending', // Placeholder
        isActive: false, // Inactive until they accept invitation
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

    // TODO: Send invitation email using Resend
    // For now, return success with temp password for testing
    
    return NextResponse.json({
      success: true,
      message: 'User invitation created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        tempPassword: tempPassword // Remove this in production
      }
    });
    
  } catch (error) {
    console.error('Error creating user invitation:', error);
    
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
