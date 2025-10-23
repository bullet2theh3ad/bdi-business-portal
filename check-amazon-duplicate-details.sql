-- Check the actual duplicate data to understand the 1,9 pattern
-- This will show us the quantities and timestamps for the duplicates

-- 1. Show detailed duplicate data for MG8702-10s (from your image)
SELECT 
    order_id,
    sku,
    quantity,
    item_price,
    posted_date,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY order_id, sku ORDER BY created_at) as row_num
FROM amazon_financial_transactions 
WHERE sku = 'MG8702-10s'
  AND posted_date >= '2025-09-20'
ORDER BY order_id, created_at;

-- 2. Show detailed duplicate data for MB7621A (from your image)  
SELECT 
    order_id,
    sku,
    quantity,
    item_price,
    posted_date,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY order_id, sku ORDER BY created_at) as row_num
FROM amazon_financial_transactions 
WHERE sku = 'MB7621A'
  AND posted_date >= '2025-09-20'
ORDER BY order_id, created_at;

-- 3. Check sync history to see overlapping periods
SELECT 
    id,
    period_start,
    period_end,
    created_at
FROM amazon_financial_transaction_syncs 
WHERE period_start >= '2025-09-20'
ORDER BY period_start DESC
LIMIT 5;

-- 4. Count total duplicates by date
SELECT 
    posted_date,
    COUNT(*) as total_records,
    COUNT(DISTINCT order_id) as unique_orders,
    COUNT(*) - COUNT(DISTINCT order_id) as duplicate_records
FROM amazon_financial_transactions 
WHERE posted_date >= '2025-09-20'
GROUP BY posted_date
ORDER BY posted_date DESC;
