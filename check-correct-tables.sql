-- Check the most promising tables for MQ20-D80W-U data
-- Run this in Supabase SQL Editor

-- 1. Check amazon_financial_daily_sales (most likely candidate)
SELECT COUNT(*) as count, 'amazon_financial_daily_sales' as table_name
FROM amazon_financial_daily_sales 
WHERE sku = 'MQ20-D80W-U';

-- 2. Check amazon_financial_sku_sales_summary
SELECT COUNT(*) as count, 'amazon_financial_sku_sales_summary' as table_name
FROM amazon_financial_sku_sales_summary 
WHERE sku = 'MQ20-D80W-U';

-- 3. Check amazon_financial_transactions
SELECT COUNT(*) as count, 'amazon_financial_transactions' as table_name
FROM amazon_financial_transactions 
WHERE sku = 'MQ20-D80W-U';

-- 4. Check sales_velocity_latest
SELECT COUNT(*) as count, 'sales_velocity_latest' as table_name
FROM sales_velocity_latest 
WHERE sku = 'MQ20-D80W-U';

-- 5. Check what MQ20 SKUs exist in the most promising table
SELECT DISTINCT sku, COUNT(*) as records
FROM amazon_financial_daily_sales 
WHERE sku LIKE '%MQ20%'
GROUP BY sku
ORDER BY sku;

-- 6. First check what columns exist in amazon_financial_daily_sales
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'amazon_financial_daily_sales'
ORDER BY ordinal_position;

-- 7. Then check recent data in amazon_financial_daily_sales (after we see the column names)
-- SELECT 
--     sku,
--     COUNT(*) as total_records,
--     MIN([date_column]) as earliest_date,
--     MAX([date_column]) as latest_date
-- FROM amazon_financial_daily_sales 
-- WHERE sku LIKE '%MQ20%'
-- GROUP BY sku
-- ORDER BY sku;
