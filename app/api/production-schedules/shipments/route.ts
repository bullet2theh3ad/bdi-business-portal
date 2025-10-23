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

    // Get shipments with their related forecast and SKU data
    const { data: shipmentsData, error: shipmentsError } = await supabase
      .from('shipments')
      .select(`
        id,
        bdi_reference,
        requested_quantity,
        status,
        estimated_ship_date,
        requested_delivery_date,
        sales_forecasts!inner(
          id,
          sku_id,
          quantity,
          delivery_week,
          shipping_preference,
          product_skus!inner(
            sku,
            name,
            description,
            mfg
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (shipmentsError) {
      console.error('Error fetching shipments with forecast data:', shipmentsError);
      return NextResponse.json({ error: 'Failed to fetch shipments' }, { status: 500 });
    }

    // Transform the data to make it easier to work with
    const transformedShipments = (shipmentsData || []).map((shipment: any) => ({
      id: shipment.id,
      bdiReference: shipment.bdi_reference,
      requestedQuantity: shipment.requested_quantity,
      status: shipment.status,
      estimatedShipDate: shipment.estimated_ship_date,
      requestedDeliveryDate: shipment.requested_delivery_date,
      forecast: shipment.sales_forecasts,
      sku: shipment.sales_forecasts?.product_skus,
      // Create a human-readable display string like: "Motorola Q15 WIFI 7 Router, Single-pack - 1,020 units - 2025-W43 - AIR_14_DAYS"
      displayName: shipment.sales_forecasts?.product_skus?.name 
        ? `${shipment.sales_forecasts.product_skus.name} - ${shipment.requested_quantity} units - ${shipment.sales_forecasts.delivery_week} - ${shipment.sales_forecasts.shipping_preference || 'STANDARD'}`
        : shipment.bdi_reference || shipment.id
    }));

    return NextResponse.json(transformedShipments);
  } catch (error) {
    console.error('Error in shipments API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
