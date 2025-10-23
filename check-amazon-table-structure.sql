-- Check the structure of Amazon financial tables
-- First, let's see what columns exist in the sync table

-- 1. Check amazon_financial_transaction_syncs table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'amazon_financial_transaction_syncs'
ORDER BY ordinal_position;

-- 2. Check amazon_financial_transactions table structure  
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'amazon_financial_transactions'
ORDER BY ordinal_position;

-- 3. Simple check for duplicates in recent data
SELECT 
    order_id,
    sku,
    COUNT(*) as duplicate_count
FROM amazon_financial_transactions 
WHERE posted_date >= '2025-09-20'
GROUP BY order_id, sku
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 10;
