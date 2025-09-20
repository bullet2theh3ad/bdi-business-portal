-- Check all existing shipments to understand their origin

-- 1. All shipments with their forecast links
SELECT 
    'ALL SHIPMENTS' as check_type,
    id,
    shipment_number,
    forecast_id,
    estimated_departure as factory_exw_date,
    estimated_arrival,
    status,
    created_at,
    CASE 
        WHEN forecast_id IS NULL THEN 'No forecast link'
        ELSE 'Linked to forecast'
    END as forecast_link_status
FROM shipments 
ORDER BY created_at DESC;

-- 2. Check if any shipments have the dates you're seeing
SELECT 
    'NOVEMBER DATE SHIPMENTS' as check_type,
    id,
    shipment_number,
    forecast_id,
    estimated_departure,
    estimated_arrival,
    created_at
FROM shipments 
WHERE estimated_departure::date = '2025-11-19' 
   OR estimated_departure::date = '2025-11-05'
ORDER BY created_at DESC;

-- 3. Check how the shipments page calculates milestone dates
-- Look for any shipments for the SKUs you're seeing
SELECT 
    'SHIPMENTS FOR SPECIFIC SKUS' as check_type,
    s.id,
    s.shipment_number,
    s.forecast_id,
    s.estimated_departure,
    f.custom_exw_date,
    f.delivery_week,
    sf.sku as sku_code
FROM shipments s
LEFT JOIN sales_forecasts f ON s.forecast_id = f.id
LEFT JOIN product_skus sf ON f.sku_id = sf.id
WHERE sf.sku IN ('MNQ1525-30W-U', 'MNQ1525-30W-U-(HSN)', 'MNB1223-30B-U-(LEG)')
ORDER BY s.created_at DESC;
