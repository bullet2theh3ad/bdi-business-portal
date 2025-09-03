import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, shipments, organizations, organizationMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with organization info
    const [dbUser] = await db
      .select({
        id: users.id,
        authId: users.authId,
        role: users.role,
        organization: {
          id: organizations.id,
          code: organizations.code,
          type: organizations.type
        }
      })
      .from(users)
      .leftJoin(organizationMembers, eq(organizationMembers.userId, users.id))
      .leftJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Access control - only certain roles can view shipments
    if (!['super_admin', 'admin', 'operations', 'sales', 'member'].includes(dbUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Fetch shipments based on user organization
    let shipmentsQuery = db.select().from(shipments);
    
    // If user is from a shipping organization, only show their shipments
    if (dbUser.organization?.type === 'shipping_logistics') {
      shipmentsQuery = shipmentsQuery.where(eq(shipments.shippingOrganizationCode, dbUser.organization.code));
    }

    const shipmentsData = await shipmentsQuery;
    
    console.log(`🚢 Fetching shipments - returning ${shipmentsData.length} shipments`);
    return NextResponse.json(shipmentsData);

  } catch (error) {
    console.error('Error fetching shipments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user info
    const [dbUser] = await db
      .select({
        id: users.id,
        authId: users.authId,
        role: users.role
      })
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Access control - only certain roles can create shipments
    if (!['super_admin', 'admin', 'operations', 'sales'].includes(dbUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      forecastId,
      shippingOrganizationCode,
      requestedQuantity,
      unitsPerCarton,
      priority,
      incoterms,
      estimatedShipDate,
      requestedDeliveryDate,
      notes,
      calculatedData
    } = body;

    // Create shipment record
    const [newShipment] = await db
      .insert(shipments)
      .values({
        forecastId,
        shippingOrganizationCode,
        requestedQuantity: requestedQuantity || 0,
        unitsPerCarton: unitsPerCarton || 5,
        priority: priority || 'standard',
        incoterms: incoterms || 'EXW',
        estimatedShipDate: estimatedShipDate ? new Date(estimatedShipDate) : null,
        requestedDeliveryDate: requestedDeliveryDate ? new Date(requestedDeliveryDate) : null,
        notes: notes || '',
        status: 'pending',
        calculatedData: calculatedData || {},
        createdBy: dbUser.id,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    console.log(`🚢 Created shipment: ${newShipment.id} for forecast ${forecastId}`);

    return NextResponse.json({
      success: true,
      message: 'Shipment created successfully',
      shipment: newShipment
    });

  } catch (error) {
    console.error('Error creating shipment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
