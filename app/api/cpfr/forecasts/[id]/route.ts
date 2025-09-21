import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get single forecast with all date fields
    const { data: forecastData, error: forecastError } = await supabase
      .from('sales_forecasts')
      .select(`
        id,
        sku_id,
        purchase_order_id,
        delivery_week,
        quantity,
        confidence,
        shipping_preference,
        forecast_type,
        status,
        sales_signal,
        factory_signal,
        shipping_signal,
        transit_signal,
        warehouse_signal,
        notes,
        created_by,
        created_at,
        custom_exw_date,
        estimated_transit_start,
        estimated_warehouse_arrival,
        confirmed_delivery_date,
        original_delivery_date,
        original_exw_date,
        original_transit_start,
        original_warehouse_arrival,
        manual_factory_lead_time,
        manual_transit_time,
        manual_warehouse_processing,
        manual_buffer_days,
        date_change_history,
        last_date_change_by,
        last_date_change_at,
        date_change_reason
      `)
      .eq('id', id)
      .single();

    if (forecastError || !forecastData) {
      return NextResponse.json(
        { error: 'Forecast not found' },
        { status: 404 }
      );
    }

    // Get SKU details
    const { data: skuData, error: skuError } = await supabase
      .from('product_skus')
      .select(`
        id,
        sku,
        name,
        description,
        hts_code,
        box_length_cm,
        box_width_cm,
        box_height_cm,
        box_weight_kg,
        carton_length_cm,
        carton_width_cm,
        carton_height_cm,
        carton_weight_kg,
        boxes_per_carton,
        pallet_length_cm,
        pallet_width_cm,
        pallet_height_cm,
        pallet_weight_kg
      `)
      .eq('id', forecastData.sku_id)
      .single();

    // Transform forecast data to match frontend interface
    const transformedForecast = {
      id: forecastData.id,
      skuId: forecastData.sku_id,
      purchaseOrderId: forecastData.purchase_order_id,
      deliveryWeek: forecastData.delivery_week,
      quantity: forecastData.quantity,
      confidence: forecastData.confidence,
      shippingPreference: forecastData.shipping_preference,
      forecastType: forecastData.forecast_type,
      status: forecastData.status,
      salesSignal: forecastData.sales_signal,
      factorySignal: forecastData.factory_signal,
      shippingSignal: forecastData.shipping_signal,
      transitSignal: forecastData.transit_signal || forecastData.shipping_signal,
      warehouseSignal: forecastData.warehouse_signal || forecastData.shipping_signal,
      notes: forecastData.notes,
      createdBy: forecastData.created_by,
      createdAt: forecastData.created_at,
      customExwDate: forecastData.custom_exw_date,
      
      // Include comprehensive date fields
      estimatedTransitStart: forecastData.estimated_transit_start,
      estimatedWarehouseArrival: forecastData.estimated_warehouse_arrival,
      confirmedDeliveryDate: forecastData.confirmed_delivery_date,
      originalDeliveryDate: forecastData.original_delivery_date,
      originalExwDate: forecastData.original_exw_date,
      originalTransitStart: forecastData.original_transit_start,
      originalWarehouseArrival: forecastData.original_warehouse_arrival,
      
      // Include manual override fields
      manualFactoryLeadTime: forecastData.manual_factory_lead_time,
      manualTransitTime: forecastData.manual_transit_time,
      manualWarehouseProcessing: forecastData.manual_warehouse_processing,
      manualBufferDays: forecastData.manual_buffer_days,
      
      // Include change tracking
      dateChangeHistory: forecastData.date_change_history || [],
      lastDateChangeBy: forecastData.last_date_change_by,
      lastDateChangeAt: forecastData.last_date_change_at,
      dateChangeReason: forecastData.date_change_reason,
      
      sku: skuData || {
        id: forecastData.sku_id,
        sku: 'UNKNOWN-SKU',
        name: 'Unknown SKU'
      }
    };

    console.log('✅ Returning fresh forecast data:', transformedForecast);
    return NextResponse.json(transformedForecast);

  } catch (error) {
    console.error('❌ Error fetching forecast:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
