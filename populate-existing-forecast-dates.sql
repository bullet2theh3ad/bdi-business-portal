-- Populate missing date fields for existing forecasts using cascade logic
-- This will calculate the missing dates based on existing custom_exw_date values

-- Default lead times (matching our API logic)
-- Factory Lead Time: 30 days
-- Transit Time: 21 days  
-- Warehouse Processing: 3 days
-- Safety Buffer: 5 days

-- Update forecasts that have custom_exw_date but missing other dates
UPDATE sales_forecasts 
SET 
    estimated_transit_start = custom_exw_date,
    estimated_warehouse_arrival = custom_exw_date + INTERVAL '21 days',
    confirmed_delivery_date = custom_exw_date + INTERVAL '29 days', -- 21 transit + 3 warehouse + 5 buffer
    original_exw_date = CASE 
        WHEN original_exw_date IS NULL THEN custom_exw_date 
        ELSE original_exw_date 
    END,
    updated_at = NOW()
WHERE 
    custom_exw_date IS NOT NULL 
    AND (
        estimated_transit_start IS NULL 
        OR estimated_warehouse_arrival IS NULL 
        OR confirmed_delivery_date IS NULL
    );

-- For forecasts without custom_exw_date, try to calculate from delivery_week
-- Convert delivery week to approximate date and work backward
UPDATE sales_forecasts 
SET 
    -- Estimate delivery date from delivery_week (assuming week starts on Monday)
    confirmed_delivery_date = CASE 
        WHEN delivery_week ~ '^[0-9]{4}-W[0-9]{1,2}$' THEN 
            (EXTRACT(YEAR FROM CAST(SPLIT_PART(delivery_week, '-W', 1) || '-01-01' AS DATE))::text || '-01-01')::date + 
            (CAST(SPLIT_PART(delivery_week, '-W', 2) AS INTEGER) - 1) * INTERVAL '7 days'
        ELSE NULL
    END,
    -- Work backward from delivery date
    estimated_warehouse_arrival = CASE 
        WHEN delivery_week ~ '^[0-9]{4}-W[0-9]{1,2}$' THEN 
            (EXTRACT(YEAR FROM CAST(SPLIT_PART(delivery_week, '-W', 1) || '-01-01' AS DATE))::text || '-01-01')::date + 
            (CAST(SPLIT_PART(delivery_week, '-W', 2) AS INTEGER) - 1) * INTERVAL '7 days' - INTERVAL '8 days' -- 3 warehouse + 5 buffer
        ELSE NULL
    END,
    estimated_transit_start = CASE 
        WHEN delivery_week ~ '^[0-9]{4}-W[0-9]{1,2}$' THEN 
            (EXTRACT(YEAR FROM CAST(SPLIT_PART(delivery_week, '-W', 1) || '-01-01' AS DATE))::text || '-01-01')::date + 
            (CAST(SPLIT_PART(delivery_week, '-W', 2) AS INTEGER) - 1) * INTERVAL '7 days' - INTERVAL '29 days' -- 21 transit + 8 warehouse/buffer
        ELSE NULL
    END,
    custom_exw_date = CASE 
        WHEN custom_exw_date IS NULL AND delivery_week ~ '^[0-9]{4}-W[0-9]{1,2}$' THEN 
            (EXTRACT(YEAR FROM CAST(SPLIT_PART(delivery_week, '-W', 1) || '-01-01' AS DATE))::text || '-01-01')::date + 
            (CAST(SPLIT_PART(delivery_week, '-W', 2) AS INTEGER) - 1) * INTERVAL '7 days' - INTERVAL '29 days'
        ELSE custom_exw_date
    END,
    updated_at = NOW()
WHERE 
    custom_exw_date IS NULL 
    AND delivery_week IS NOT NULL
    AND delivery_week ~ '^[0-9]{4}-W[0-9]{1,2}$'
    AND (
        estimated_transit_start IS NULL 
        OR estimated_warehouse_arrival IS NULL 
        OR confirmed_delivery_date IS NULL
    );

-- Set original dates for tracking (if not already set)
UPDATE sales_forecasts 
SET 
    original_delivery_date = CASE 
        WHEN original_delivery_date IS NULL THEN confirmed_delivery_date 
        ELSE original_delivery_date 
    END,
    original_transit_start = CASE 
        WHEN original_transit_start IS NULL THEN estimated_transit_start 
        ELSE original_transit_start 
    END,
    original_warehouse_arrival = CASE 
        WHEN original_warehouse_arrival IS NULL THEN estimated_warehouse_arrival 
        ELSE original_warehouse_arrival 
    END,
    updated_at = NOW()
WHERE 
    (original_delivery_date IS NULL AND confirmed_delivery_date IS NOT NULL)
    OR (original_transit_start IS NULL AND estimated_transit_start IS NOT NULL)
    OR (original_warehouse_arrival IS NULL AND estimated_warehouse_arrival IS NOT NULL);

-- Verify the updates
SELECT 
    id,
    delivery_week,
    custom_exw_date,
    estimated_transit_start,
    estimated_warehouse_arrival,
    confirmed_delivery_date,
    original_exw_date,
    date_change_history
FROM sales_forecasts 
ORDER BY created_at DESC 
LIMIT 5;

-- Show summary of populated dates
SELECT 
    COUNT(*) as total_forecasts,
    COUNT(custom_exw_date) as has_exw_date,
    COUNT(estimated_transit_start) as has_transit_start,
    COUNT(estimated_warehouse_arrival) as has_warehouse_arrival,
    COUNT(confirmed_delivery_date) as has_delivery_date
FROM sales_forecasts;
