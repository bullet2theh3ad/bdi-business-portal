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

    // Verify user belongs to BDI organization
    const userOrgMembership = await db
      .select({
        organization: {
          code: organizations.code,
          type: organizations.type,
        }
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
      .where(eq(organizationMembers.userAuthId, currentUser.authId))
      .limit(1);

    const isBDIUser = userOrgMembership.some(membership => 
      membership.organization.code === 'BDI' && membership.organization.type === 'internal'
    );

    if (!isBDIUser) {
      return NextResponse.json({ error: 'Forbidden - BDI access required' }, { status: 403 });
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

// POST method removed - use /api/organization/users/invite for user invitations
