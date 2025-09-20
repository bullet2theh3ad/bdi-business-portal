-- Check the relationship between forecasts and shipments
-- and see what's happening with the dates

-- 1. Check all shipments and their linked forecasts
SELECT 
    'ALL SHIPMENTS WITH FORECASTS' as check_type,
    s.id as shipment_id,
    s.shipment_number,
    s.forecast_id,
    s.estimated_departure as shipment_exw_date,
    s.estimated_arrival,
    s.status as shipment_status,
    s.created_at as shipment_created,
    f.id as forecast_id,
    f.custom_exw_date as forecast_custom_exw,
    f.delivery_week,
    f.shipping_preference,
    f.created_at as forecast_created
FROM shipments s
LEFT JOIN sales_forecasts f ON s.forecast_id = f.id
ORDER BY s.created_at DESC
LIMIT 10;

-- 2. Check if there are shipments WITHOUT forecast links
SELECT 
    'SHIPMENTS WITHOUT FORECASTS' as check_type,
    id,
    shipment_number,
    forecast_id,
    estimated_departure,
    created_at
FROM shipments 
WHERE forecast_id IS NULL
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check the specific forecast with custom date and any related shipments
SELECT 
    'CUSTOM DATE FORECAST DETAILS' as check_type,
    f.id as forecast_id,
    f.custom_exw_date,
    f.delivery_week,
    f.shipping_preference,
    f.status as forecast_status,
    f.created_at as forecast_created,
    COUNT(s.id) as shipment_count,
    MAX(s.estimated_departure) as latest_shipment_exw,
    MAX(s.created_at) as latest_shipment_created
FROM sales_forecasts f
LEFT JOIN shipments s ON s.forecast_id = f.id
WHERE f.custom_exw_date = '2025-10-20'
GROUP BY f.id, f.custom_exw_date, f.delivery_week, f.shipping_preference, f.status, f.created_at;

-- 4. Check if there are orphaned shipments (forecast_id points to deleted forecasts)
SELECT 
    'ORPHANED SHIPMENTS' as check_type,
    s.id,
    s.shipment_number,
    s.forecast_id,
    s.estimated_departure,
    s.created_at,
    'Forecast not found' as issue
FROM shipments s
LEFT JOIN sales_forecasts f ON s.forecast_id = f.id
WHERE s.forecast_id IS NOT NULL 
AND f.id IS NULL
ORDER BY s.created_at DESC;
