-- Check for refund transactions that might explain the 1,9 pattern
-- Look for transactions with negative revenue or refund transaction types

-- 1. Check transaction types
SELECT 
    transaction_type,
    COUNT(*) as count,
    SUM(quantity) as total_quantity,
    SUM(gross_revenue) as total_gross_revenue,
    SUM(net_revenue) as total_net_revenue
FROM amazon_financial_transactions 
WHERE posted_date >= '2025-09-20'
GROUP BY transaction_type
ORDER BY transaction_type;

-- 2. Check for negative revenue transactions
SELECT 
    order_id,
    sku,
    quantity,
    item_price,
    gross_revenue,
    net_revenue,
    posted_date,
    transaction_type
FROM amazon_financial_transactions 
WHERE posted_date >= '2025-09-20'
  AND (gross_revenue < 0 OR net_revenue < 0)
ORDER BY posted_date DESC
LIMIT 20;

-- 3. Check for specific order patterns that might show 1,9 pattern
SELECT 
    order_id,
    COUNT(*) as transaction_count,
    SUM(quantity) as total_quantity,
    SUM(gross_revenue) as total_gross_revenue,
    STRING_AGG(transaction_type, ', ') as transaction_types
FROM amazon_financial_transactions 
WHERE posted_date >= '2025-09-20'
GROUP BY order_id
HAVING COUNT(*) > 1
ORDER BY transaction_count DESC
LIMIT 10;
