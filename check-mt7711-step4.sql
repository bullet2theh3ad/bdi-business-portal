-- Step 4: Check what Amazon SKUs exist that might be related to MT7711-10
SELECT 
    'amazon_skus_like_mt7711' as table_name,
    sku as amazon_sku,
    COUNT(*) as transaction_count,
    MIN(posted_date) as first_transaction,
    MAX(posted_date) as last_transaction
FROM amazon_financial_transactions 
WHERE sku LIKE '%MT7711%' 
   OR sku LIKE '%7711%'
   OR sku LIKE '%MT%7711%'
GROUP BY sku
ORDER BY transaction_count DESC;
