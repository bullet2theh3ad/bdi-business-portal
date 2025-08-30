import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { organizations, users, organizationMembers, organizationConnections } from '@/lib/db/schema';
import { eq, and, or, ne } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for organization connection
const createConnectionSchema = z.object({
  organizationAId: z.string().uuid('Valid organization ID required'),
  organizationBId: z.string().uuid('Valid organization ID required'),
  connectionType: z.enum(['messaging', 'file_share', 'full_collaboration']),
  description: z.string().optional(),
  permissions: z.object({
    canChat: z.boolean(),
    canViewFiles: z.boolean(),
    canShareFiles: z.boolean(),
    canViewUsers: z.boolean(),
    canViewTeams: z.boolean(),
    canCreateCrossOrgTeams: z.boolean(),
  }),
});

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

    // Get the requesting user's role and organization
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

    // Get all organization connections with both organization details
    const connectionsRaw = await db
      .select({
        id: organizationConnections.id,
        organizationAId: organizationConnections.organizationAId,
        organizationBId: organizationConnections.organizationBId,
        connectionType: organizationConnections.connectionType,
        status: organizationConnections.status,
        permissions: organizationConnections.permissions,
        description: organizationConnections.description,
        startDate: organizationConnections.startDate,
        endDate: organizationConnections.endDate,
        createdAt: organizationConnections.createdAt,
        updatedAt: organizationConnections.updatedAt,
      })
      .from(organizationConnections);

    // Manually fetch organization details for each connection
    const connections = await Promise.all(
      connectionsRaw.map(async (conn) => {
        const [orgA] = await db
          .select({ name: organizations.name, code: organizations.code })
          .from(organizations)
          .where(eq(organizations.id, conn.organizationAId))
          .limit(1);

        const [orgB] = await db
          .select({ name: organizations.name, code: organizations.code })
          .from(organizations)
          .where(eq(organizations.id, conn.organizationBId))
          .limit(1);

        return {
          ...conn,
          organizationAName: orgA?.name || 'Unknown',
          organizationACode: orgA?.code || 'UNK',
          organizationBName: orgB?.name || 'Unknown',
          organizationBCode: orgB?.code || 'UNK',
        };
      })
    );

    console.log('Organization connections found:', connections.length);

    return NextResponse.json(connections);

  } catch (error) {
    console.error('Error fetching organization connections:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // Verify super admin permission
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

    const body = await request.json();
    console.log('Received connection request:', body);
    
    const validatedData = createConnectionSchema.parse(body);
    console.log('Validated connection data:', validatedData);

    // Check if connection already exists (bidirectional)
    const existingConnection = await db
      .select()
      .from(organizationConnections)
      .where(
        or(
          and(
            eq(organizationConnections.organizationAId, validatedData.organizationAId),
            eq(organizationConnections.organizationBId, validatedData.organizationBId)
          ),
          and(
            eq(organizationConnections.organizationAId, validatedData.organizationBId),
            eq(organizationConnections.organizationBId, validatedData.organizationAId)
          )
        )
      )
      .limit(1);

    if (existingConnection.length > 0) {
      return NextResponse.json(
        { error: 'Connection already exists between these organizations' },
        { status: 400 }
      );
    }

    // Create the connection
    const [newConnection] = await db
      .insert(organizationConnections)
      .values({
        organizationAId: validatedData.organizationAId,
        organizationBId: validatedData.organizationBId,
        connectionType: validatedData.connectionType,
        description: validatedData.description,
        permissions: validatedData.permissions,
        createdBy: requestingUser.authId,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log('Created organization connection:', newConnection);

    return NextResponse.json({
      success: true,
      connection: newConnection,
      message: 'Organization connection created successfully'
    });

  } catch (error) {
    console.error('Error creating organization connection:', error);
    
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.errors);
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
