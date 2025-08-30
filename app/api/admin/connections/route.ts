import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { organizations, users, organizationMembers, organizationConnections } from '@/lib/db/schema';
import { eq, and, or, ne } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for asymmetric organization connection
const createConnectionSchema = z.object({
  sourceOrganizationId: z.string().uuid('Valid source organization ID required'),
  targetOrganizationId: z.string().uuid('Valid target organization ID required'),
  connectionType: z.enum(['messaging', 'file_share', 'full_collaboration']),
  description: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  permissions: z.object({
    canViewPublicData: z.boolean().default(true),
    canViewPartnerData: z.boolean().default(false),
    canViewConfidentialData: z.boolean().default(false),
    canViewInternalData: z.boolean().default(false),
    canViewUsers: z.boolean().default(false),
    canViewTeams: z.boolean().default(false),
    canCreateCrossOrgTeams: z.boolean().default(false),
    canChat: z.boolean().default(false),
    canViewFiles: z.boolean().default(false),
    canShareFiles: z.boolean().default(false),
    canDownloadFiles: z.boolean().default(false),
    canUploadFiles: z.boolean().default(false),
  }),
  allowedDataCategories: z.array(z.enum(['public', 'partner', 'confidential', 'internal'])).default(['public']),
});

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 GET /api/admin/connections - Starting...');
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

    // Simplified user lookup (like other working APIs)
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, authUser.email!))
      .limit(1);

    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Access denied. Super Admin required.' }, { status: 403 });
    }

    // Fetch all directional connections with organization names
    console.log('📊 About to fetch connections from database...');
    console.log('📊 organizationConnections table:', organizationConnections);
    console.log('📊 db object:', typeof db);
    const connections = await db
      .select({
        id: organizationConnections.id,
        sourceOrganizationId: organizationConnections.sourceOrganizationId,
        targetOrganizationId: organizationConnections.targetOrganizationId,
        connectionType: organizationConnections.connectionType,
        status: organizationConnections.status,
        permissions: organizationConnections.permissions,
        allowedDataCategories: organizationConnections.allowedDataCategories,
        description: organizationConnections.description,
        tags: organizationConnections.tags,
        startDate: organizationConnections.startDate,
        endDate: organizationConnections.endDate,
        createdAt: organizationConnections.createdAt,
        updatedAt: organizationConnections.updatedAt,
      })
      .from(organizationConnections)
      .where(eq(organizationConnections.status, 'active'));
    
    console.log(`📊 Found ${connections.length} connections:`, connections);

    // If no connections, return empty arrays
    if (connections.length === 0) {
      console.log('📊 No connections found, returning empty arrays');
      return NextResponse.json({
        connections: [],
        directionalConnections: [],
      });
    }

    // Process connections (only if we have some)
    const orgIds = new Set<string>();
    connections.forEach(conn => {
      if (conn.sourceOrganizationId && conn.targetOrganizationId) {
        orgIds.add(conn.sourceOrganizationId);
        orgIds.add(conn.targetOrganizationId);
      }
    });

    console.log('📊 Fetching organization data for IDs:', Array.from(orgIds));
    const orgsData = await db
      .select({ id: organizations.id, name: organizations.name, code: organizations.code })
      .from(organizations)
      .where(or(...Array.from(orgIds).map(id => eq(organizations.id, id))));

    const orgMap = new Map(orgsData.map(org => [org.id, org]));
    console.log('📊 Organization map created:', orgMap);

    // Transform connections to include organization names
    const connectionsWithNames = connections.map(conn => ({
      ...conn,
      sourceOrganizationName: orgMap.get(conn.sourceOrganizationId)?.name || 'Unknown',
      sourceOrganizationCode: orgMap.get(conn.sourceOrganizationId)?.code || 'UNK',
      targetOrganizationName: orgMap.get(conn.targetOrganizationId)?.name || 'Unknown',
      targetOrganizationCode: orgMap.get(conn.targetOrganizationId)?.code || 'UNK',
    }));

    console.log('📊 Connections with names:', connectionsWithNames);

    // Simple bilateral grouping
    const bilateralConnections: any[] = [];
    const processedPairs = new Set<string>();

    connectionsWithNames.forEach(conn => {
      const pairKey = [conn.sourceOrganizationId, conn.targetOrganizationId].sort().join('|');
      
      if (!processedPairs.has(pairKey)) {
        processedPairs.add(pairKey);
        
        bilateralConnections.push({
          id: pairKey,
          organizationA: {
            id: conn.sourceOrganizationId,
            name: conn.sourceOrganizationName,
            code: conn.sourceOrganizationCode,
          },
          organizationB: {
            id: conn.targetOrganizationId,
            name: conn.targetOrganizationName,
            code: conn.targetOrganizationCode,
          },
          connections: {
            aToB: {
              id: conn.id,
              connectionType: conn.connectionType,
              permissions: conn.permissions,
              allowedDataCategories: conn.allowedDataCategories,
              description: conn.description,
              tags: conn.tags,
            },
            bToA: null,
          },
          status: 'active',
          createdAt: conn.createdAt,
          updatedAt: conn.updatedAt,
        });
      }
    });

    console.log('📊 Final bilateral connections:', bilateralConnections);

    return NextResponse.json({
      connections: bilateralConnections,
      directionalConnections: connectionsWithNames,
    });

  } catch (error) {
    console.error('Error fetching connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 POST /api/admin/connections - Starting...');
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

    // Simplified user lookup (like other working APIs)
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, authUser.email!))
      .limit(1);

    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Access denied. Super Admin required.' }, { status: 403 });
    }

    console.log('🚀 POST: About to read request body...');
    const body = await request.json();
    console.log('🚀 POST: Request body:', JSON.stringify(body, null, 2));
    
    const validatedData = createConnectionSchema.parse(body);
    console.log('Validated data:', JSON.stringify(validatedData, null, 2));

    // Prevent self-connections
    if (validatedData.sourceOrganizationId === validatedData.targetOrganizationId) {
      return NextResponse.json(
        { error: 'Organizations cannot connect to themselves' },
        { status: 400 }
      );
    }

    // Check if connection already exists
    const [existingConnection] = await db
      .select()
      .from(organizationConnections)
      .where(
        and(
          eq(organizationConnections.sourceOrganizationId, validatedData.sourceOrganizationId),
          eq(organizationConnections.targetOrganizationId, validatedData.targetOrganizationId)
        )
      )
      .limit(1);

    if (existingConnection) {
      return NextResponse.json(
        { error: 'Connection already exists between these organizations' },
        { status: 409 }
      );
    }

    // Create the directional connection
    let newConnection;
    try {
      console.log('Inserting connection with values:', {
        sourceOrganizationId: validatedData.sourceOrganizationId,
        targetOrganizationId: validatedData.targetOrganizationId,
        connectionType: validatedData.connectionType,
        permissions: validatedData.permissions,
        allowedDataCategories: validatedData.allowedDataCategories,
        description: validatedData.description || null,
        tags: validatedData.tags || [],
        createdBy: user.authId,
      });

      [newConnection] = await db
        .insert(organizationConnections)
        .values({
          sourceOrganizationId: validatedData.sourceOrganizationId,
          targetOrganizationId: validatedData.targetOrganizationId,
          connectionType: validatedData.connectionType,
          permissions: validatedData.permissions,
          allowedDataCategories: validatedData.allowedDataCategories,
          description: validatedData.description || null,
          tags: validatedData.tags || [],
          createdBy: user.authId,
        })
        .returning();

      console.log('Connection created successfully:', newConnection);
    } catch (dbError) {
      console.error('Database insert error:', dbError);
      throw dbError;
    }

    return NextResponse.json({
      message: 'Directional connection created successfully',
      connection: newConnection,
    });

  } catch (error) {
    console.error('Error creating connection:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create connection' },
      { status: 500 }
    );
  }
}