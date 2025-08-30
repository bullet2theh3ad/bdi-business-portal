import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { organizations, users, organizationMembers } from '@/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';

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

    // Get the requesting user's role
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser || requestingUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden - Super Admin required' }, { status: 403 });
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
      .where(eq(organizationMembers.userAuthId, requestingUser.authId))
      .limit(1);

    const isBDIUser = userOrgMembership.some(membership => 
      membership.organization.code === 'BDI' && membership.organization.type === 'internal'
    );

    if (!isBDIUser) {
      return NextResponse.json({ error: 'Forbidden - BDI Super Admin required' }, { status: 403 });
    }

    // Get all external organizations (not BDI)
    const externalOrganizations = await db
      .select()
      .from(organizations)
      .where(
        // Exclude BDI organization - anything that's not 'internal' type
        ne(organizations.type, 'internal')
      );

    console.log('External organizations found:', externalOrganizations);

    // Ensure we always return an array
    return NextResponse.json(Array.isArray(externalOrganizations) ? externalOrganizations : []);

  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
