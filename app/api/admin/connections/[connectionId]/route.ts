import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { organizations, users, organizationMembers, organizationConnections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
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

    const { connectionId } = await params;
    console.log('Deleting organization connection:', connectionId);

    // Get connection details for logging
    const [connection] = await db
      .select({
        id: organizationConnections.id,
        organizationAId: organizationConnections.organizationAId,
        organizationBId: organizationConnections.organizationBId,
        connectionType: organizationConnections.connectionType,
        description: organizationConnections.description,
        orgAName: organizations.name,
        orgACode: organizations.code,
      })
      .from(organizationConnections)
      .leftJoin(organizations, eq(organizations.id, organizationConnections.organizationAId))
      .where(eq(organizationConnections.id, connectionId))
      .limit(1);

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    console.log('Found connection to delete:', connection);

    // Get organization B details
    const [orgB] = await db
      .select({
        name: organizations.name,
        code: organizations.code,
      })
      .from(organizations)
      .where(eq(organizations.id, connection.organizationBId))
      .limit(1);

    // Delete the connection
    const deletedConnection = await db
      .delete(organizationConnections)
      .where(eq(organizationConnections.id, connectionId))
      .returning();

    console.log('Deleted connection:', deletedConnection);

    return NextResponse.json({
      success: true,
      message: `Connection between "${connection.orgAName}" and "${orgB?.name}" has been removed.`,
      deletedConnection: {
        id: connection.id,
        organizationA: { name: connection.orgAName, code: connection.orgACode },
        organizationB: { name: orgB?.name, code: orgB?.code },
        connectionType: connection.connectionType
      }
    });

  } catch (error) {
    console.error('Error deleting organization connection:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
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

    const { connectionId } = await params;
    const body = await request.json();
    
    console.log('Updating connection:', connectionId, body);

    // Update the connection
    const [updatedConnection] = await db
      .update(organizationConnections)
      .set({
        connectionType: body.connectionType,
        permissions: body.permissions,
        description: body.description,
        status: body.status,
        updatedAt: new Date(),
      })
      .where(eq(organizationConnections.id, connectionId))
      .returning();

    console.log('Updated connection:', updatedConnection);

    return NextResponse.json({
      success: true,
      connection: updatedConnection,
      message: 'Connection updated successfully'
    });

  } catch (error) {
    console.error('Error updating organization connection:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
