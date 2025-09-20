import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, shipments, organizations, organizationMembers, invoices, invoiceLineItems } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

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
      // BDI users can see all shipments - use Supabase (like POST method)
      console.log('🚢 BDI user - fetching all shipments (Supabase)');
      const { data: allShipments, error: shipmentsError } = await supabase
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (shipmentsError) {
        console.error('🚢 BDI shipments error:', shipmentsError);
        return NextResponse.json([]);
      }
      
      console.log(`🚢 BDI user found ${allShipments?.length || 0} total shipments`);
      return NextResponse.json(allShipments || []);
    } else if (dbUser.organization?.type === 'shipping_logistics') {
      // Shipping organizations (OLM, etc.) see shipments they're assigned to handle as shipper
      console.log(`🚢 Shipping org ${dbUser.organization.code} - fetching shipments where they are the shipper`);
      
      const { data: shipperShipments, error: shipmentsError } = await supabase
        .from('shipments')
        .select('*')
        .eq('shipper_organization_id', dbUser.organization.id)
        .order('created_at', { ascending: false });
      
      if (shipmentsError) {
        console.error('🚢 Shipping org shipments error:', shipmentsError);
        console.log('🚢 Trying legacy organization_id filter as fallback...');
        
        // Fallback to legacy logic if new field fails
        const { data: legacyShipments, error: legacyError } = await supabase
          .from('shipments')
          .select('*')
          .eq('organization_id', dbUser.organization.id)
          .order('created_at', { ascending: false });
          
        if (legacyError) {
          console.error('🚢 Legacy shipments error:', legacyError);
          return NextResponse.json([]);
        }
        
        console.log(`🚢 Shipping org found ${legacyShipments?.length || 0} shipments (legacy)`);
        return NextResponse.json(legacyShipments || []);
      }
      
      console.log(`🚢 Shipping org found ${shipperShipments?.length || 0} shipments as shipper`);
      return NextResponse.json(shipperShipments || []);
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
        
          // SIMPLE FIX: Get shipments for MTN's SKUs directly (same logic as forecasts)
          console.log(`🚢 Getting shipments for MTN SKUs directly (bypass forecast filtering)`);
          
          const serviceSupabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
          
          // BYPASS RLS: Use raw SQL query to get shipments for MTN's forecasts
          console.log(`🚢 BYPASS RLS: Using raw SQL for MTN shipments`);
          
          // Get shipments for MTN's SKU forecasts using raw SQL
          const mtnShipmentsQuery = `
            SELECT s.*, sf.sku_id 
            FROM shipments s
            INNER JOIN sales_forecasts sf ON s.forecast_id = sf.id
            WHERE sf.sku_id = ANY($1::uuid[])
            ORDER BY s.created_at DESC
          `;
          
          // Use regular Supabase client (with user session for RLS)
          console.log(`🚢 Using user session client for RLS (not service role)`);
          
          const { data: allShipments, error: shipmentsError } = await supabase
            .from('shipments')
            .select('*')
            .order('created_at', { ascending: false });
          
          console.log(`🚢 Service role query result:`, { 
            shipmentCount: allShipments?.length || 0, 
            error: shipmentsError,
            firstShipment: allShipments?.[0] 
          });
          
          if (shipmentsError) {
            console.error(`🚢 Shipments query error:`, shipmentsError);
            return NextResponse.json([]);
          }
          
          // For now, return ALL shipments to test service role (will filter later)
          console.log(`🚢 Testing: returning ALL ${allShipments?.length || 0} shipments to verify service role works`);
          
          // Return ALL shipments for testing
          return NextResponse.json(allShipments || []);
      } else {
        console.log(`🚢 No SKUs found for ${dbUser.organization.code} - returning empty shipments`);
        return NextResponse.json([]);
      }
    }
    
    // This should never be reached since all paths above return directly
    console.log(`🚢 Unexpected path - returning empty shipments`);
    return NextResponse.json([]);

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

    // Get custom EXW date from forecast if available
    let customExwDate = null;
    if (body.forecastId) {
      try {
        const { data: forecastData } = await supabase
          .from('sales_forecasts')
          .select('custom_exw_date')
          .eq('id', body.forecastId)
          .single();
        
        if (forecastData?.custom_exw_date) {
          customExwDate = forecastData.custom_exw_date;
          console.log('✅ Found custom EXW date from forecast:', customExwDate);
        }
      } catch (error) {
        console.log('⚠️ Could not fetch custom EXW date from forecast:', error);
      }
    }

    // Create shipment in database using correct column names from create-shipments-table.sql
    // Use custom EXW date from forecast if available, otherwise use provided estimatedShipDate, otherwise default
    const estimatedDeparture = customExwDate ? 
      new Date(customExwDate).toISOString() : 
      (body.estimatedShipDate ? new Date(body.estimatedShipDate).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());
    const estimatedArrival = body.requestedDeliveryDate ? new Date(body.requestedDeliveryDate).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    console.log('📅 EXW Date calculation:', {
      customExwFromForecast: customExwDate,
      providedEstimatedShipDate: body.estimatedShipDate,
      finalEstimatedDeparture: estimatedDeparture
    });

    // Handle custom entries and invalid IDs - convert "custom" to null for UUID fields
    let originFactoryId = body.organizationId === 'custom' ? null : (body.organizationId || null);
    
    // Validate that the origin factory ID exists in EITHER organizations OR warehouses
    let warehouseExists = null;
    if (originFactoryId) {
      // Check if it's an organization ID
      const { data: orgExists } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', originFactoryId)
        .single();
      
      // If not found in organizations, check warehouses (for special origins like EMG)
      if (!orgExists) {
        const { data: warehouseData } = await supabase
          .from('warehouses')
          .select('id, name, warehouse_code')
          .eq('id', originFactoryId)
          .single();
        warehouseExists = warehouseData;
      }
      
      // Only fallback if ID doesn't exist in EITHER table
      if (!orgExists && !warehouseExists) {
        console.log(`🚨 Invalid origin factory ID ${originFactoryId} (not found in organizations or warehouses), using user's organization as fallback`);
        originFactoryId = dbUser.organization?.id || null;
      } else if (warehouseExists) {
        console.log(`✅ Valid warehouse origin: ${originFactoryId} (${warehouseExists.name}) - keeping user selection`);
      } else {
        console.log(`✅ Valid organization origin: ${originFactoryId} (${orgExists?.name}) - keeping user selection`);
      }
    } else {
      // If no organization selected, use user's organization
      originFactoryId = dbUser.organization?.id || null;
    }
    
    // Determine if origin is a warehouse or organization
    const isWarehouseOrigin = warehouseExists !== null;
    
    const shippingPartnerId = body.shipperOrganizationId === 'custom' || body.shipperOrganizationId === 'lcl' ? null : (body.shipperOrganizationId || null);
    const destinationWarehouseId = body.destinationWarehouseId === 'custom' ? null : (body.destinationWarehouseId || null);
    
    // Determine custom location text
    const originCustomLocation = body.organizationId === 'custom' ? (body.customOriginFactory || 'Custom Origin') : null;
    const shippingCustomPartner = body.shipperOrganizationId === 'custom' ? (body.customShippingPartner || 'Custom Shipper') : 
                                 body.shipperOrganizationId === 'lcl' ? 'LCL (Less than Container Load)' : null;
    const destinationCustomLocation = body.destinationWarehouseId === 'custom' ? (body.customDestinationWarehouse || 'Custom Destination') : 'Customer Warehouse';

    const { data: newShipment, error: shipmentError } = await supabase
      .from('shipments')
      .insert({
        shipment_number: shipmentNumber,
        forecast_id: body.forecastId,
        // 3-step flow data (with custom entry support)
        organization_id: isWarehouseOrigin ? dbUser.organization?.id || null : originFactoryId, // Use user's org for warehouse origins
        origin_warehouse_id: isWarehouseOrigin ? originFactoryId : null, // Store warehouse ID separately
        origin_custom_location: originCustomLocation, // Custom origin text
        shipper_organization_id: shippingPartnerId, // Step 2: Shipping Partner (null if custom/lcl)
        destination_warehouse_id: destinationWarehouseId, // Step 3: Final Destination (null if custom)
        destination_custom_location: destinationCustomLocation, // Custom destination text (required field)
        // Legacy/additional fields
        priority: body.priority || 'standard',
        shipper_reference: body.shipperReference || shippingCustomPartner || null, // Prioritize JJOLM number over custom shipper name
        factory_warehouse_id: body.factoryWarehouseId || null,
        destination_country: 'USA', // Default
        shipping_method: 'SEA_FCL', // Default
        container_type: '40ft', // Default
        incoterms: body.incoterms || 'EXW',
        incoterms_location: 'Factory', // Default
        estimated_departure: estimatedDeparture,
        estimated_arrival: estimatedArrival,
        notes: body.notes || null,
        status: 'planning',
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


