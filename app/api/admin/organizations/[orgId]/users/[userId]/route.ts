import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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

// Create Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  if (!authUser) return null;
  
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.authId, authUser.id))
    .limit(1);

  return dbUser;
}

// DELETE - Remove user from organization (Super Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized - Super Admin required' }, { status: 401 });
    }

    const { orgId, userId } = await params;
    
    // Get the target organization
    const [targetOrganization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!targetOrganization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get the user to delete
    const [userToDelete] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userToDelete) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user belongs to the target organization
    const [userMembership] = await db
      .select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userAuthId, userToDelete.authId),
        eq(organizationMembers.organizationUuid, targetOrganization.id)
      ))
      .limit(1);

    if (!userMembership) {
      return NextResponse.json({ error: 'User does not belong to this organization' }, { status: 403 });
    }

    // Delete from Supabase auth if user is active
    if (userToDelete.isActive && userToDelete.passwordHash === 'supabase_managed') {
      try {
        await supabaseAdmin.auth.admin.deleteUser(userToDelete.authId);
        console.log(`Deleted Supabase auth user: ${userToDelete.authId}`);
      } catch (supabaseError) {
        console.warn(`Failed to delete Supabase auth user ${userToDelete.authId}:`, supabaseError);
        // Continue with database deletion even if Supabase deletion fails
      }
    }

    // Remove organization membership
    await db
      .delete(organizationMembers)
      .where(and(
        eq(organizationMembers.userAuthId, userToDelete.authId),
        eq(organizationMembers.organizationUuid, targetOrganization.id)
      ));

    // Soft delete the user (mark as deleted)
    await db
      .update(users)
      .set({ 
        deletedAt: new Date(),
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    console.log(`Super Admin deleted user ${userToDelete.email} from organization ${targetOrganization.code}`);
    
    return NextResponse.json({
      success: true,
      message: 'User removed from organization successfully',
      deletedUser: {
        id: userToDelete.id,
        name: userToDelete.name,
        email: userToDelete.email,
      },
      organization: {
        id: targetOrganization.id,
        name: targetOrganization.name,
        code: targetOrganization.code,
      }
    });
    
  } catch (error) {
    console.error('Error deleting user from organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Activate/Deactivate user (Super Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized - Super Admin required' }, { status: 401 });
    }

    const { orgId, userId } = await params;
    const body = await request.json();
    const { action } = body; // 'activate' or 'deactivate'
    
    if (!action || !['activate', 'deactivate'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "activate" or "deactivate"' }, { status: 400 });
    }

    // Get the target organization
    const [targetOrganization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!targetOrganization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get the user to update
    const [userToUpdate] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userToUpdate) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user belongs to the target organization
    const [userMembership] = await db
      .select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userAuthId, userToUpdate.authId),
        eq(organizationMembers.organizationUuid, targetOrganization.id)
      ))
      .limit(1);

    if (!userMembership) {
      return NextResponse.json({ error: 'User does not belong to this organization' }, { status: 403 });
    }

    const isActive = action === 'activate';

    // Update user status
    const [updatedUser] = await db
      .update(users)
      .set({ 
        isActive: isActive,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    console.log(`Super Admin ${action}d user ${updatedUser.email} in organization ${targetOrganization.code}`);
    
    return NextResponse.json({
      success: true,
      message: `User ${action}d successfully`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        isActive: updatedUser.isActive,
      },
      organization: {
        id: targetOrganization.id,
        name: targetOrganization.name,
        code: targetOrganization.code,
      }
    });
    
  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
