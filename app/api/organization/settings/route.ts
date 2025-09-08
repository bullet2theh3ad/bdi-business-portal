import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the requesting user
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only admins can view organization settings
    if (!['admin', 'super_admin'].includes(requestingUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get user's organization and its settings
    const [membershipWithOrg] = await db
      .select({
        organization: {
          id: organizations.id,
          name: organizations.name,
          code: organizations.code,
          enabledPages: organizations.enabledPages,
        },
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationUuid, organizations.id))
      .where(eq(organizationMembers.userAuthId, requestingUser.authId))
      .limit(1);

    if (!membershipWithOrg) {
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 404 });
    }

    return NextResponse.json({
      organization: membershipWithOrg.organization,
      enabledPages: membershipWithOrg.organization.enabledPages || {},
    });
  } catch (error) {
    console.error('Error fetching organization settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { enabledPages } = body;

    // Get the requesting user
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only admins can update organization settings
    if (!['admin', 'super_admin'].includes(requestingUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get user's organization
    const [membershipWithOrg] = await db
      .select({
        organization: {
          id: organizations.id,
          name: organizations.name,
          code: organizations.code,
        },
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationUuid, organizations.id))
      .where(eq(organizationMembers.userAuthId, requestingUser.authId))
      .limit(1);

    if (!membershipWithOrg) {
      return NextResponse.json({ error: 'User not associated with any organization' }, { status: 404 });
    }

    const orgId = membershipWithOrg.organization.id;

    // Update organization's enabled pages
    await db
      .update(organizations)
      .set({ enabledPages })
      .where(eq(organizations.id, orgId));

    console.log(`Updated page access settings for organization: ${membershipWithOrg.organization.name} (${membershipWithOrg.organization.code})`);

    return NextResponse.json({ 
      message: 'Organization settings updated successfully',
      enabledPages 
    });
  } catch (error) {
    console.error('Error updating organization settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
