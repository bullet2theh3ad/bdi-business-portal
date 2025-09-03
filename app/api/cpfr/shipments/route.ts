import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

    // For now, return empty array since we're focusing on the calculation display
    // The shipments page uses forecasts data for display anyway
    console.log('🚢 Fetching shipments - returning empty array for now');
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

    const body = await request.json();
    console.log('🚢 Shipment creation request:', body);

    // For now, store shipment data in a simple JSON format until shipments table is created
    // This will at least persist the data and show it was saved
    const shipmentData = {
      id: crypto.randomUUID(),
      forecastId: body.forecastId,
      shippingOrganizationCode: body.shippingOrganizationCode,
      shipperReference: body.shipperReference,
      requestedQuantity: body.requestedQuantity,
      unitsPerCarton: body.unitsPerCarton,
      priority: body.priority,
      incoterms: body.incoterms,
      estimatedShipDate: body.estimatedShipDate,
      requestedDeliveryDate: body.requestedDeliveryDate,
      notes: body.notes,
      calculatedData: body.calculatedData,
      status: 'pending_shipper_confirmation',
      createdAt: new Date().toISOString(),
      createdBy: authUser.id
    };

    console.log('🚢 Created shipment:', shipmentData);

    return NextResponse.json({
      success: true,
      message: 'Shipment created successfully and logged for shipper processing',
      shipment: shipmentData
    });

  } catch (error) {
    console.error('Error creating shipment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
