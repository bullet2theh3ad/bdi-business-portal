-- Refresh Supabase schema cache to recognize new columns
-- This fixes the "Could not find column in schema cache" errors

-- Method 1: Send notification to PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Method 2: Alternative approach - just verify our columns exist
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'sales_forecasts' 
    AND column_name IN (
        'estimated_transit_start',
        'estimated_warehouse_arrival',
        'confirmed_delivery_date',
        'custom_exw_date',
        'manual_transit_time',
        'date_change_history'
    )
ORDER BY column_name;

-- Show a sample forecast with the new fields
SELECT 
    id,
    delivery_week,
    custom_exw_date,
    estimated_transit_start,
    estimated_warehouse_arrival,
    confirmed_delivery_date,
    date_change_history
FROM sales_forecasts 
ORDER BY created_at DESC 
LIMIT 2;
