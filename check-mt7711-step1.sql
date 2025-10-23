-- Step 1: Check if MT7711-10 exists in amazon_financial_transactions
SELECT 
    'amazon_financial_transactions' as table_name,
    sku,
    COUNT(*) as transaction_count,
    MIN(posted_date) as first_transaction,
    MAX(posted_date) as last_transaction,
    SUM(quantity) as total_units,
    SUM(net_revenue) as total_revenue
FROM amazon_financial_transactions 
WHERE sku = 'MT7711-10'
GROUP BY sku;
