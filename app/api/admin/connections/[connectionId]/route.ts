import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { organizations, users, organizationMembers, organizationConnections } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for updating connection permissions
const updateConnectionSchema = z.object({
  connectionType: z.enum(['messaging', 'file_share', 'full_collaboration']).optional(),
  status: z.enum(['active', 'pending', 'suspended']).optional(),
  permissions: z.object({
    canViewPublicData: z.boolean(),
    canViewPartnerData: z.boolean(),
    canViewConfidentialData: z.boolean(),
    canViewInternalData: z.boolean(),
    canViewUsers: z.boolean(),
    canViewTeams: z.boolean(),
    canCreateCrossOrgTeams: z.boolean(),
    canChat: z.boolean(),
    canViewFiles: z.boolean(),
    canShareFiles: z.boolean(),
    canDownloadFiles: z.boolean(),
    canUploadFiles: z.boolean(),
  }).optional(),
  allowedDataCategories: z.array(z.enum(['public', 'partner', 'confidential', 'internal'])).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

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

    // Get the requesting user's role and organization
    const [user] = await db
      .select({
        id: users.id,
        authId: users.authId,
        email: users.email,
        role: users.role,
        organizationId: organizationMembers.organizationId,
      })
      .from(users)
      .leftJoin(organizationMembers, eq(users.authId, organizationMembers.userAuthId))
      .where(eq(users.email, authUser.email!))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Security check: Only BDI Super Admin can delete connections
    const [userOrg] = await db
      .select({ code: organizations.code })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId!))
      .limit(1);

    if (user.role !== 'super_admin' || userOrg?.code !== 'BDI') {
      return NextResponse.json({ error: 'Access denied. BDI Super Admin required.' }, { status: 403 });
    }

    const { connectionId } = params;

    // Check if this is a bilateral connection ID (contains '|') or single directional connection
    if (connectionId.includes('|')) {
      // Bilateral disconnect - delete both directions
      const [orgAId, orgBId] = connectionId.split('|');
      
      // Delete both directional connections
      const deletedConnections = await db
        .delete(organizationConnections)
        .where(
          or(
            and(
              eq(organizationConnections.sourceOrganizationId, orgAId),
              eq(organizationConnections.targetOrganizationId, orgBId)
            ),
            and(
              eq(organizationConnections.sourceOrganizationId, orgBId),
              eq(organizationConnections.targetOrganizationId, orgAId)
            )
          )
        )
        .returning();

      return NextResponse.json({
        message: `Bilateral connection disconnected successfully`,
        deletedConnections: deletedConnections.length,
      });
    } else {
      // Single directional connection delete
      const [deletedConnection] = await db
        .delete(organizationConnections)
        .where(eq(organizationConnections.id, connectionId))
        .returning();

      if (!deletedConnection) {
        return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
      }

      return NextResponse.json({
        message: 'Directional connection deleted successfully',
        deletedConnection,
      });
    }

  } catch (error) {
    console.error('Error deleting connection:', error);
    return NextResponse.json(
      { error: 'Failed to delete connection' },
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

    // Get the requesting user's role and organization
    const [user] = await db
      .select({
        id: users.id,
        authId: users.authId,
        email: users.email,
        role: users.role,
        organizationId: organizationMembers.organizationId,
      })
      .from(users)
      .leftJoin(organizationMembers, eq(users.authId, organizationMembers.userAuthId))
      .where(eq(users.email, authUser.email!))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Security check: Only BDI Super Admin can update connections
    const [userOrg] = await db
      .select({ code: organizations.code })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId!))
      .limit(1);

    if (user.role !== 'super_admin' || userOrg?.code !== 'BDI') {
      return NextResponse.json({ error: 'Access denied. BDI Super Admin required.' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateConnectionSchema.parse(body);
    const { connectionId } = params;

    // Check if this is a bilateral update or single directional update
    if (connectionId.includes('|')) {
      return NextResponse.json(
        { error: 'Bilateral updates not supported. Update individual directional connections.' },
        { status: 400 }
      );
    }

    // Update single directional connection
    const [updatedConnection] = await db
      .update(organizationConnections)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(organizationConnections.id, connectionId))
      .returning();

    if (!updatedConnection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Connection updated successfully',
      connection: updatedConnection,
    });

  } catch (error) {
    console.error('Error updating connection:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update connection' },
      { status: 500 }
    );
  }
}