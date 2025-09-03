import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, shipments, organizations, organizationMembers } from '@/lib/db/schema';
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

    // Get user with organization info for access control
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
      .leftJoin(organizationMembers, eq(organizationMembers.userAuthId, users.authId))
      .leftJoin(organizations, eq(organizations.id, organizationMembers.organizationUuid))
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch shipments based on user organization using Supabase client
    let shipmentsQuery = supabase.from('shipments').select('*');
    
    // If user is from a shipping organization, only show their shipments
    if (dbUser.organization?.type === 'shipping_logistics' && dbUser.organization.code) {
      shipmentsQuery = shipmentsQuery.eq('shipping_organization_code', dbUser.organization.code);
    }
    
    const { data: shipmentsData, error: shipmentsError } = await shipmentsQuery;
    
    if (shipmentsError) {
      console.error('🚢 Error fetching shipments:', shipmentsError);
      return NextResponse.json({ error: 'Failed to fetch shipments' }, { status: 500 });
    }
    
    console.log(`🚢 Fetching shipments - returning ${shipmentsData?.length || 0} shipments`);
    return NextResponse.json(shipmentsData || []);

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

    // Get user info for audit trail
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
    console.log('🚢 Shipment creation request:', body);

    // Generate shipment number
    const shipmentNumber = `BDI-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // Create shipment in database using Supabase client (simpler than Drizzle schema mismatch)
    const { data: newShipment, error: shipmentError } = await supabase
      .from('shipments')
      .insert({
        shipment_number: shipmentNumber,
        forecast_id: body.forecastId,
        shipping_organization_code: body.shippingOrganizationCode,
        shipper_reference: body.shipperReference || null,
        requested_quantity: body.requestedQuantity || 0,
        units_per_carton: body.unitsPerCarton || 5,
        priority: body.priority || 'standard',
        incoterms: body.incoterms || 'EXW',
        destination_custom_location: 'TBD', // Required field
        destination_country: 'USA', // Default
        shipping_method: 'SEA_FCL', // Default
        container_type: '40ft', // Default
        incoterms_location: 'Factory', // Default
        estimated_ship_date: body.estimatedShipDate || null,
        requested_delivery_date: body.requestedDeliveryDate || null,
        notes: body.notes || null,
        calculated_data: body.calculatedData || {},
        status: 'pending_shipper_confirmation',
        created_by: dbUser.id
      })
      .select()
      .single();

    if (shipmentError) {
      console.error('🚢 Error creating shipment:', shipmentError);
      return NextResponse.json({ error: 'Failed to create shipment', details: shipmentError.message }, { status: 500 });
    }

    console.log('🚢 Created shipment in database:', newShipment);

    return NextResponse.json({
      success: true,
      message: 'Shipment created successfully in database!',
      shipment: newShipment
    });

  } catch (error) {
    console.error('Error creating shipment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
