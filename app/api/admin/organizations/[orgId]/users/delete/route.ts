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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || !['super_admin', 'admin'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Unauthorized - Admin required' }, { status: 401 });
    }

    const { orgId } = await params;
    const body = await request.json();
    const { email, userAuthId } = body;

    if (!email || !userAuthId) {
      return NextResponse.json({ error: 'Email and userAuthId required' }, { status: 400 });
    }

    console.log(`🗑️ ADMIN DELETE - Deleting user ${email} (${userAuthId}) from organization ${orgId}`);

    // 1. Delete organization memberships first (foreign key constraint)
    await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.userAuthId, userAuthId));

    // 2. Delete the user record
    await db
      .delete(users)
      .where(eq(users.email, email));

    // 3. Clean up any legacy invitation tokens
    await db
      .delete(organizationInvitations)
      .where(eq(organizationInvitations.invitedEmail, email));

    console.log(`✅ ADMIN DELETE - Successfully deleted user ${email}`);

    return NextResponse.json({
      success: true,
      message: `User ${email} has been permanently deleted and is now available for invitation`
    });
    
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
