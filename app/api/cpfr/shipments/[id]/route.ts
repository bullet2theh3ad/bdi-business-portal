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
        status: 'planning', // Keep status as planning for quote requests
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

    return NextResponse.json({
      success: true,
      message: 'Shipment updated successfully in database!',
      shipment: updatedShipment
    });

  } catch (error) {
    console.error('Error updating shipment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
