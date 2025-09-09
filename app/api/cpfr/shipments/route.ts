import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, shipments, organizations, organizationMembers, invoices, invoiceLineItems } from '@/lib/db/schema';
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
    
    const isBDIUser = dbUser.organization?.code === 'BDI' && dbUser.organization?.type === 'internal';
    
    if (isBDIUser) {
      // BDI users can see all shipments
      console.log('🚢 BDI user - fetching all shipments');
    } else if (dbUser.organization?.type === 'shipping_logistics') {
      // Shipping organizations see their own shipments
      console.log(`🚢 Shipping org ${dbUser.organization.code} - fetching their shipments`);
      shipmentsQuery = shipmentsQuery.eq('shipping_organization_code', dbUser.organization.code);
    } else if (dbUser.organization?.code) {
      // Partner organizations (MTN, CBN, etc.) see shipments for forecasts they can see
      console.log(`🚢 Partner org ${dbUser.organization.code} - fetching shipments for their SKUs`);
      
      // Use same logic as forecasts API - get SKUs this partner can see via invoices
      // Use Drizzle for the complex join query
      const partnerSkuIds = await db
        .select({
          skuId: invoiceLineItems.skuId
        })
        .from(invoiceLineItems)
        .innerJoin(invoices, eq(invoices.id, invoiceLineItems.invoiceId))
        .where(eq(invoices.customerName, dbUser.organization.code));
      
      const allowedSkuIds = partnerSkuIds.map(item => item.skuId);
      
      console.log(`🔍 Found ${allowedSkuIds.length} SKU IDs for ${dbUser.organization.code}:`, allowedSkuIds);
      
      if (allowedSkuIds.length > 0) {
        
        // Get forecasts for these SKUs, then get shipments for those forecasts
        const { data: allowedForecasts, error: forecastError } = await supabase
          .from('sales_forecasts')
          .select('id')
          .in('sku_id', allowedSkuIds);
        
        if (allowedForecasts && allowedForecasts.length > 0) {
          const forecastIds = allowedForecasts.map(f => f.id);
          shipmentsQuery = shipmentsQuery.in('forecast_id', forecastIds);
          console.log(`🚢 Found ${forecastIds.length} forecasts for ${dbUser.organization.code} shipments`);
        } else {
          console.log(`🚢 No forecasts found for ${dbUser.organization.code} SKUs - returning empty shipments`);
          return NextResponse.json([]);
        }
      } else {
        console.log(`🚢 No SKUs found for ${dbUser.organization.code} - returning empty shipments`);
        return NextResponse.json([]);
      }
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

    // Get user info with organization for RLS compliance
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

    // Access control - only certain roles can create shipments
    if (!['super_admin', 'admin', 'operations', 'sales'].includes(dbUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    console.log('🚢 Shipment creation request:', body);

    // Generate shipment number
    const shipmentNumber = `BDI-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // Create shipment in database using correct column names from create-shipments-table.sql
    const estimatedDeparture = body.estimatedShipDate ? new Date(body.estimatedShipDate).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const estimatedArrival = body.requestedDeliveryDate ? new Date(body.requestedDeliveryDate).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: newShipment, error: shipmentError } = await supabase
      .from('shipments')
      .insert({
        shipment_number: shipmentNumber,
        forecast_id: body.forecastId,
        priority: body.priority || 'standard',
        shipper_reference: body.shipperReference || null,
        factory_warehouse_id: body.factoryWarehouseId || null,
        destination_custom_location: 'Customer Warehouse', // Required field
        destination_country: 'USA', // Default
        shipping_method: 'SEA_FCL', // Default
        container_type: '40ft', // Default
        incoterms: body.incoterms || 'EXW',
        incoterms_location: 'Factory', // Default
        estimated_departure: estimatedDeparture,
        estimated_arrival: estimatedArrival,
        notes: body.notes || null,
        status: 'planning',
        organization_id: dbUser.organization?.id || null, // Required for RLS
        created_by: dbUser.authId // Use authId, not id (foreign key to users.auth_id)
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


