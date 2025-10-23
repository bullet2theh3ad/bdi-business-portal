-- Check for duplicate patterns in Amazon financial transactions
-- This will help identify if the 1,9,1,9 pattern exists in the database

-- 1. Check for duplicate order_id + sku combinations
SELECT 
    order_id,
    sku,
    COUNT(*) as duplicate_count,
    STRING_AGG(quantity::text, ', ' ORDER BY created_at) as quantities,
    STRING_AGG(item_price::text, ', ' ORDER BY created_at) as item_prices,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM amazon_financial_transactions 
WHERE posted_date >= '2025-09-20'  -- Recent data
GROUP BY order_id, sku
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, order_id, sku
LIMIT 20;

-- 2. Check for the specific 1,9 pattern
SELECT 
    order_id,
    sku,
    quantity,
    item_price,
    posted_date,
    created_at
FROM amazon_financial_transactions 
WHERE posted_date >= '2025-09-20'
  AND order_id IN (
    SELECT order_id 
    FROM amazon_financial_transactions 
    WHERE posted_date >= '2025-09-20'
    GROUP BY order_id, sku
    HAVING COUNT(*) > 1
  )
ORDER BY order_id, sku, created_at;

-- 3. Check import history to see if there are overlapping syncs
SELECT 
    id,
    period_start,
    period_end,
    total_records,
    status,
    error_message
FROM amazon_financial_transaction_syncs 
WHERE period_start >= '2025-09-20'
ORDER BY period_start DESC
LIMIT 10;

-- 4. Check for specific SKUs mentioned in the image
SELECT 
    sku,
    order_id,
    quantity,
    item_price,
    posted_date,
    created_at
FROM amazon_financial_transactions 
WHERE sku IN ('MG8702-10s', 'MB7621A')
  AND posted_date >= '2025-09-20'
ORDER BY sku, order_id, created_at;
