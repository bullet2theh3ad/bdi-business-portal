import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { organizations, users, organizationMembers, warehouses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shipmentId } = await params;
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
            }
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with organization info for fallback validation (same as create API)
    const [dbUser] = await db
      .select({
        id: users.id,
        authId: users.authId,
        organization: {
          id: organizations.id,
          name: organizations.name,
          code: organizations.code,
          type: organizations.type
        }
      })
      .from(users)
      .leftJoin(organizationMembers, eq(users.authId, organizationMembers.userAuthId))
      .leftJoin(organizations, eq(organizationMembers.organizationUuid, organizations.id))
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    console.log('🔧 Updating shipment:', shipmentId, body);

    // Update shipment in database
    const estimatedDeparture = body.estimatedShipDate ? new Date(body.estimatedShipDate).toISOString() : null;
    const estimatedArrival = body.requestedDeliveryDate ? new Date(body.requestedDeliveryDate).toISOString() : null;

    // Handle custom entries - convert "custom" to null for UUID fields (same as create API)
    let originFactoryId = body.organizationId === 'custom' ? null : (body.organizationId || null);
    const shippingPartnerId = body.shipperOrganizationId === 'custom' || body.shipperOrganizationId === 'lcl' ? null : (body.shipperOrganizationId || null);
    const destinationWarehouseId = body.destinationWarehouseId === 'custom' ? null : (body.destinationWarehouseId || null);

    // CRITICAL: Validate origin factory ID exists in EITHER organizations OR warehouses
    let warehouseExists: any[] = [];
    if (originFactoryId) {
      // Check if it's an organization ID
      const orgExists = await db.select().from(organizations).where(eq(organizations.id, originFactoryId)).limit(1);
      
      // If not found in organizations, check warehouses (for special origins like EMG)
      if (orgExists.length === 0) {
        warehouseExists = await db.select().from(warehouses).where(eq(warehouses.id, originFactoryId)).limit(1);
      }
      
      // Only fallback if ID doesn't exist in EITHER table
      if (orgExists.length === 0 && warehouseExists.length === 0) {
        console.log(`🚨 Invalid origin factory ID: ${originFactoryId} (not found in organizations or warehouses), falling back to user's organization`);
        originFactoryId = dbUser.organization?.id || null;
      } else if (warehouseExists.length > 0) {
        console.log(`✅ Valid warehouse origin: ${originFactoryId} (${warehouseExists[0]?.name}) - keeping user selection`);
      } else {
        console.log(`✅ Valid organization origin: ${originFactoryId} - keeping user selection`);
      }
    }
    
    // Determine if origin is a warehouse or organization
    const isWarehouseOrigin = warehouseExists.length > 0;
    
    // Determine custom location text
    const originCustomLocation = body.organizationId === 'custom' ? (body.customOriginFactory || 'Custom Origin') : null;
    const shippingCustomPartner = body.shipperOrganizationId === 'custom' ? (body.customShippingPartner || 'Custom Shipper') : 
                                 body.shipperOrganizationId === 'lcl' ? 'LCL (Less than Container Load)' : null;
    const destinationCustomLocation = body.destinationWarehouseId === 'custom' ? (body.customDestinationWarehouse || 'Custom Destination') : 'Customer Warehouse';
    
    // Prepare update data with proper validation
    const updateData: any = {
      // 3-step flow data - CRITICAL UPDATE (with custom entry support)
      organization_id: isWarehouseOrigin ? dbUser.organization?.id || null : originFactoryId, // Use user's org for warehouse origins
      origin_warehouse_id: isWarehouseOrigin ? originFactoryId : null, // Store warehouse ID separately
      origin_custom_location: originCustomLocation, // Custom origin text
      shipper_organization_id: shippingPartnerId, // Step 2: Shipping Partner (null if custom/lcl)
      destination_warehouse_id: destinationWarehouseId, // Step 3: Final Destination (null if custom)
      destination_custom_location: destinationCustomLocation || body.destinationCustomLocation || 'Customer Warehouse', // Custom destination text (required NOT NULL)
      // Legacy/additional fields
      priority: body.priority || 'standard',
      shipper_reference: body.shipperReference || shippingCustomPartner || null,
      factory_warehouse_id: body.factoryWarehouseId || null,
      incoterms: body.incoterms || 'EXW',
      notes: body.notes || null,
      status: 'draft', // Use standardized status
      // Update signals if provided
      sales_signal: body.salesSignal || null,
      factory_signal: body.factorySignal || null,
      shipping_signal: body.shippingSignal || null,
      updated_at: new Date().toISOString()
    };

    // Only update dates if provided (avoid overwriting existing dates with null)
    if (estimatedDeparture) {
      updateData.estimated_departure = estimatedDeparture;
    }
    if (estimatedArrival) {
      updateData.estimated_arrival = estimatedArrival;
    }

    console.log('🔧 Update data being sent:', updateData);

    const { data: updatedShipment, error: shipmentError } = await supabase
      .from('shipments')
      .update(updateData)
      .eq('id', shipmentId)
      .select()
      .single();

    if (shipmentError) {
      console.error('🔧 Error updating shipment:', shipmentError);
      console.error('🔧 Error details:', {
        message: shipmentError.message,
        code: shipmentError.code,
        details: shipmentError.details,
        hint: shipmentError.hint
      });
      console.error('🔧 Update data that failed:', updateData);
      return NextResponse.json({ 
        error: 'Failed to update shipment', 
        details: shipmentError.message,
        code: shipmentError.code,
        hint: shipmentError.hint,
        updateData: updateData
      }, { status: 500 });
    }

    console.log('🔧 Updated shipment in database:', updatedShipment);

    // 🔄 BI-DIRECTIONAL SYNC: Update linked forecast signals if signals were changed
    if (body.salesSignal || body.factorySignal || body.shippingSignal) {
      console.log('🔄 Syncing forecast signals with shipment...');
      
      if (updatedShipment.forecast_id) {
        const forecastUpdateData: any = {
          updated_at: new Date().toISOString()
        };
        
        // Only update signals that were provided
        if (body.salesSignal) forecastUpdateData.sales_signal = body.salesSignal;
        if (body.factorySignal) forecastUpdateData.factory_signal = body.factorySignal;
        if (body.shippingSignal) forecastUpdateData.shipping_signal = body.shippingSignal;
        
        const { error: forecastUpdateError } = await supabase
          .from('sales_forecasts')
          .update(forecastUpdateData)
          .eq('id', updatedShipment.forecast_id);
        
        if (forecastUpdateError) {
          console.error('⚠️ Failed to sync forecast signals:', forecastUpdateError);
        } else {
          console.log(`✅ Synced forecast with shipment signals`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Shipment updated successfully in database!',
      shipment: updatedShipment,
      syncedForecast: !!(body.salesSignal || body.factorySignal || body.shippingSignal)
    });

  } catch (error) {
    console.error('Error updating shipment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
