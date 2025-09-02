import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { organizations, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
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

    // Verify user is Super Admin
    const [requestingUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!requestingUser || requestingUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden - Super Admin required' }, { status: 403 });
    }

    const body = await request.json();
    const { cpfrContacts } = body;

    console.log('🔄 Updating CPFR contacts for organization:', orgId);
    console.log('📧 CPFR contacts data:', cpfrContacts);

    // Validate CPFR contacts structure
    if (!cpfrContacts || typeof cpfrContacts !== 'object') {
      return NextResponse.json({ error: 'Invalid CPFR contacts data' }, { status: 400 });
    }

    // Validate email addresses in contacts
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const primaryContacts = cpfrContacts.primary_contacts || [];
    const escalationContacts = cpfrContacts.escalation_contacts || [];
    
    for (const contact of [...primaryContacts, ...escalationContacts]) {
      if (contact.email && !emailRegex.test(contact.email)) {
        return NextResponse.json({ 
          error: `Invalid email format: ${contact.email}` 
        }, { status: 400 });
      }
    }

    // Update organization with new CPFR contacts
    const [updatedOrg] = await db
      .update(organizations)
      .set({
        cpfrContacts: cpfrContacts,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, orgId))
      .returning();

    if (!updatedOrg) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    console.log('✅ CPFR contacts updated successfully');
    
    return NextResponse.json({
      success: true,
      organization: updatedOrg,
      message: 'CPFR contacts updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating CPFR contacts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
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

    // Get organization CPFR contacts
    const [organization] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        code: organizations.code,
        cpfrContacts: organizations.cpfrContacts
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({
      organization,
      cpfrContacts: organization.cpfrContacts
    });

  } catch (error) {
    console.error('❌ Error fetching CPFR contacts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
