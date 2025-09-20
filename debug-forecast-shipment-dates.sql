-- Debug forecast to shipment date flow
-- Check what's stored in the database vs what's being displayed

-- 1. Check the forecast data with custom EXW date
SELECT 
    'FORECAST DATA' as check_type,
    id,
    sku_id,
    delivery_week,
    shipping_preference,
    custom_exw_date,
    custom_lead_time,
    status,
    created_at
FROM sales_forecasts 
WHERE custom_exw_date IS NOT NULL
ORDER BY created_at DESC
LIMIT 3;

-- 2. Check all recent forecasts to see custom_exw_date values
SELECT 
    'ALL RECENT FORECASTS' as check_type,
    id,
    delivery_week,
    shipping_preference,
    custom_exw_date,
    status,
    created_at
FROM sales_forecasts 
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check shipments linked to forecasts with custom dates
SELECT 
    'SHIPMENT DATA' as check_type,
    s.id as shipment_id,
    s.shipment_number,
    s.forecast_id,
    s.estimated_departure,
    s.estimated_arrival,
    s.status as shipment_status,
    s.created_at as shipment_created,
    f.custom_exw_date as forecast_custom_exw,
    f.delivery_week as forecast_delivery_week,
    f.shipping_preference as forecast_shipping
FROM shipments s
LEFT JOIN sales_forecasts f ON s.forecast_id = f.id
ORDER BY s.created_at DESC
LIMIT 5;

-- 4. Check if there are any shipments for the specific forecast with custom date
SELECT 
    'SPECIFIC FORECAST SHIPMENTS' as check_type,
    s.*,
    f.custom_exw_date,
    f.delivery_week
FROM shipments s
JOIN sales_forecasts f ON s.forecast_id = f.id
WHERE f.custom_exw_date = '2025-10-20'
ORDER BY s.created_at DESC;

-- 5. Check the latest forecast with custom date
SELECT 
    'LATEST CUSTOM DATE FORECAST' as check_type,
    *
FROM sales_forecasts 
WHERE custom_exw_date = '2025-10-20'
ORDER BY created_at DESC
LIMIT 1;
