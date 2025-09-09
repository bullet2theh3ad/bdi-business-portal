import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

    const body = await request.json();
    console.log('🔧 Updating shipment:', shipmentId, body);

    // Update shipment in database
    const estimatedDeparture = body.estimatedShipDate ? new Date(body.estimatedShipDate).toISOString() : null;
    const estimatedArrival = body.requestedDeliveryDate ? new Date(body.requestedDeliveryDate).toISOString() : null;

    const { data: updatedShipment, error: shipmentError } = await supabase
      .from('shipments')
      .update({
        priority: body.priority || 'standard',
        shipper_reference: body.shipperReference || null,
        factory_warehouse_id: body.factoryWarehouseId || null,
        incoterms: body.incoterms || 'EXW',
        estimated_departure: estimatedDeparture,
        estimated_arrival: estimatedArrival,
        notes: body.notes || null,
        status: 'draft', // Use standardized status
        // Update signals if provided
        sales_signal: body.salesSignal || null,
        factory_signal: body.factorySignal || null,
        shipping_signal: body.shippingSignal || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', shipmentId)
      .select()
      .single();

    if (shipmentError) {
      console.error('🔧 Error updating shipment:', shipmentError);
      return NextResponse.json({ error: 'Failed to update shipment', details: shipmentError.message }, { status: 500 });
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
