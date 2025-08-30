import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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
    
    if (!currentUser || !['super_admin', 'admin'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userEmail } = body;

    if (!userEmail) {
      return NextResponse.json({ error: 'User email required' }, { status: 400 });
    }

    // Prevent self-deletion
    if (currentUser.email === userEmail) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 403 });
    }

    console.log('Complete cleanup for:', userEmail);

    // Step 1: Remove organization memberships first (to avoid foreign key constraints)
    const deletedMemberships = await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.userAuthId, 
        db.select({ authId: users.authId }).from(users).where(eq(users.email, userEmail))
      ))
      .returning();

    console.log('Deleted memberships:', deletedMemberships.length);

    // Step 2: Get user info before deletion
    const [userToDelete] = await db
      .select()
      .from(users)
      .where(eq(users.email, userEmail))
      .limit(1);

    if (!userToDelete) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Step 3: Completely remove the user record
    const deletedUsers = await db
      .delete(users)
      .where(eq(users.email, userEmail))
      .returning();

    console.log('Deleted users:', deletedUsers.length);

    // Step 4: Verify complete removal
    const [remainingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, userEmail))
      .limit(1);

    if (remainingUser) {
      console.error('User still exists after deletion:', remainingUser);
      return NextResponse.json({ error: 'Failed to completely remove user' }, { status: 500 });
    }

    console.log('✅ User completely removed:', userEmail);

    return NextResponse.json({
      success: true,
      message: `User ${userEmail} has been completely removed from the system`
    });
    
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
