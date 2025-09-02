-- Fix TC1 CPFR Access - Update Customer Name
-- Changes MTN to TC1 so TC1 users can see their forecasts

-- Step 1: Check current state
SELECT 
    'BEFORE UPDATE' as status,
    invoice_number,
    customer_name,
    total_value
FROM invoices 
WHERE customer_name IN ('MTN', 'TC1')
ORDER BY created_at DESC;

-- Step 2: Update MTN to TC1
BEGIN;

UPDATE invoices 
SET 
    customer_name = 'TC1',
    updated_at = NOW()
WHERE customer_name = 'MTN';

-- Step 3: Verify the update
SELECT 
    'AFTER UPDATE' as status,
    invoice_number,
    customer_name,
    total_value,
    updated_at
FROM invoices 
WHERE customer_name = 'TC1'
ORDER BY updated_at DESC;

-- Step 4: Check how many forecasts TC1 can now see
SELECT 
    'TC1 FORECAST ACCESS' as info,
    COUNT(*) as forecasts_tc1_can_see,
    STRING_AGG(DISTINCT ps.sku, ', ') as sku_codes
FROM sales_forecasts sf
JOIN product_skus ps ON sf.sku_id = ps.id
WHERE sf.sku_id IN (
    SELECT ili.sku_id
    FROM invoice_line_items ili
    JOIN invoices i ON ili.invoice_id = i.id
    WHERE i.customer_name = 'TC1'
);

-- Commit the changes
COMMIT;

-- Final verification
SELECT 
    'FINAL CHECK' as status,
    'TC1 can now access CPFR forecasts' as message,
    COUNT(*) as forecast_count
FROM sales_forecasts sf
WHERE sf.sku_id IN (
    SELECT ili.sku_id
    FROM invoice_line_items ili
    JOIN invoices i ON ili.invoice_id = i.id
    WHERE i.customer_name = 'TC1'
);
