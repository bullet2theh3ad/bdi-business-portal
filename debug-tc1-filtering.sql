-- Debug TC1 CPFR Filtering Issue
-- Check why TC1 users see 0 forecasts

-- Step 1: Check current invoices and their customer names
SELECT 
    'CURRENT INVOICES' as info,
    invoice_number,
    customer_name,
    total_value,
    created_at
FROM invoices 
ORDER BY created_at DESC;

-- Step 2: Check invoice line items and their SKUs
SELECT 
    'INVOICE LINE ITEMS' as info,
    i.invoice_number,
    i.customer_name,
    ili.sku_code,
    ili.sku_name,
    ili.quantity,
    ili.unit_cost
FROM invoice_line_items ili
JOIN invoices i ON ili.invoice_id = i.id
ORDER BY i.created_at DESC;

-- Step 3: Check forecasts and their SKUs
SELECT 
    'CURRENT FORECASTS' as info,
    sf.id,
    sf.delivery_week,
    sf.quantity,
    sf.sales_signal,
    sf.factory_signal,
    ps.sku,
    ps.name
FROM sales_forecasts sf
JOIN product_skus ps ON sf.sku_id = ps.id
ORDER BY sf.created_at DESC;

-- Step 4: Check what SKUs TC1 should be able to see
-- (This is what the filtering logic is doing)
SELECT 
    'TC1 ALLOWED SKUS' as info,
    ili.sku_id,
    ps.sku,
    ps.name,
    i.customer_name
FROM invoice_line_items ili
JOIN invoices i ON ili.invoice_id = i.id
JOIN product_skus ps ON ili.sku_id = ps.id
WHERE i.customer_name = 'TC1';

-- Step 5: If no results above, check what customer names we have
SELECT 
    'ALL CUSTOMER NAMES' as info,
    DISTINCT customer_name,
    COUNT(*) as invoice_count
FROM invoices 
GROUP BY customer_name
ORDER BY customer_name;

-- SOLUTION: Update MTN to TC1 if needed
-- UPDATE invoices 
-- SET customer_name = 'TC1' 
-- WHERE customer_name = 'MTN';

-- Verify the fix would work
SELECT 
    'AFTER TC1 UPDATE' as info,
    COUNT(*) as forecasts_tc1_would_see
FROM sales_forecasts sf
WHERE sf.sku_id IN (
    SELECT ili.sku_id
    FROM invoice_line_items ili
    JOIN invoices i ON ili.invoice_id = i.id
    WHERE i.customer_name = 'TC1'  -- Change to 'MTN' to test current state
);
