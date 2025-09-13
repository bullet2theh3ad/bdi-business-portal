import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizationMembers, organizationInvitations } from '@/lib/db/schema';
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
    .where(eq(users.authId, authUser.id))
    .limit(1);

  return dbUser;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🗑️ DELETE USER - Starting delete process');
    
    const currentUser = await getCurrentUser();
    console.log('🗑️ DELETE USER - Current user role:', currentUser?.role);
    
    if (!currentUser || !['super_admin', 'admin'].includes(currentUser.role)) {
      console.log('🗑️ DELETE USER - Authorization failed');
      return NextResponse.json({ error: 'Unauthorized - Admin required' }, { status: 401 });
    }

    const body = await request.json();
    console.log('🗑️ DELETE USER - Processing delete request');
    
    const { email } = body;

    if (!email) {
      console.log('🗑️ DELETE USER - Missing email');
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    console.log('🗑️ DELETE USER - Looking up user to delete');

    // Find the user to delete
    const [userToDelete] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    console.log('🗑️ DELETE USER - Found user:', !!userToDelete);

    if (!userToDelete) {
      console.log('🗑️ DELETE USER - User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('🗑️ DELETE USER - Step 1: Deleting organization memberships');
    
    // 1. Delete organization memberships first (foreign key constraint)
    await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.userAuthId, userToDelete.authId));

    console.log('🗑️ DELETE USER - Step 2: Deleting user record');

    // 2. Delete the user record
    await db
      .delete(users)
      .where(eq(users.email, email));

    console.log('🗑️ DELETE USER - Step 3: Deleting Supabase auth user');

    // 3. Also delete from Supabase auth to prevent future invitation conflicts
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.authId);
      
      if (deleteAuthError) {
        console.error('🗑️ DELETE USER - Failed to delete Supabase auth user:', deleteAuthError);
        // Don't fail the whole operation - database deletion succeeded
      } else {
        console.log('🗑️ DELETE USER - ✅ Deleted Supabase auth user:', userToDelete.email);
      }
    } catch (authError) {
      console.error('🗑️ DELETE USER - Error deleting Supabase auth user:', authError);
      // Don't fail the whole operation - database deletion succeeded
    }

    console.log('🗑️ DELETE USER - Step 4: Cleaning up legacy invitations');

    // 3. Clean up any legacy invitation tokens
    await db
      .delete(organizationInvitations)
      .where(eq(organizationInvitations.invitedEmail, email));

    console.log('🗑️ DELETE USER - ✅ Successfully deleted user');

    return NextResponse.json({
      success: true,
      message: `User ${email} has been permanently deleted`,
      deletedUser: {
        email: userToDelete.email,
        name: userToDelete.name,
        id: userToDelete.id
      }
    });
    
  } catch (error) {
    console.error('🗑️ DELETE USER - ❌ Error:', error);
    console.error('🗑️ DELETE USER - Error type:', typeof error);
    console.error('🗑️ DELETE USER - Error details:', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}