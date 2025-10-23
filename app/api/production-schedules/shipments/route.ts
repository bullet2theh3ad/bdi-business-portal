import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const skuId = searchParams.get('skuId');
    
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
    let query = supabase
      .from('shipments')
      .select(`
        id,
        shipment_number,
        status,
        estimated_departure,
        estimated_arrival,
        shipping_method,
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

    // Filter by SKU if provided
    if (skuId) {
      query = query.eq('sales_forecasts.sku_id', skuId);
    }

    const { data: shipmentsData, error: shipmentsError } = await query;

    if (shipmentsError) {
      console.error('Error fetching shipments with forecast data:', shipmentsError);
      return NextResponse.json({ error: 'Failed to fetch shipments' }, { status: 500 });
    }

    // Transform the data to make it easier to work with
    const transformedShipments = (shipmentsData || []).map((shipment: any) => ({
      id: shipment.id,
      shipmentNumber: shipment.shipment_number,
      status: shipment.status,
      estimatedDeparture: shipment.estimated_departure,
      estimatedArrival: shipment.estimated_arrival,
      shippingMethod: shipment.shipping_method,
      forecast: shipment.sales_forecasts,
      sku: shipment.sales_forecasts?.product_skus,
      // Create a human-readable display string like: "Motorola Q15 WIFI 7 Router, Single-pack - 1,020 units - 2025-W43 - AIR_14_DAYS"
      displayName: shipment.sales_forecasts?.product_skus?.name 
        ? `${shipment.sales_forecasts.product_skus.name} - ${shipment.sales_forecasts.quantity} units - ${shipment.sales_forecasts.delivery_week} - ${shipment.shipping_method || 'STANDARD'}`
        : shipment.shipment_number || shipment.id
    }));

    return NextResponse.json(transformedShipments);
  } catch (error) {
    console.error('Error in shipments API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
