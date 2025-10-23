-- Final check for MQ20-D80W-U in amazon_financial_daily_sales
-- Run this in Supabase SQL Editor

-- 1. Check if MQ20-D80W-U exists in amazon_financial_daily_sales
SELECT COUNT(*) as count, 'amazon_financial_daily_sales' as table_name
FROM amazon_financial_daily_sales 
WHERE sku = 'MQ20-D80W-U';

-- 2. Check what MQ20 SKUs exist in amazon_financial_daily_sales
SELECT DISTINCT sku, COUNT(*) as records
FROM amazon_financial_daily_sales 
WHERE sku LIKE '%MQ20%'
GROUP BY sku
ORDER BY sku;

-- 3. Check recent data for MQ20 SKUs
SELECT 
    sku,
    COUNT(*) as total_records,
    MIN(sale_date) as earliest_date,
    MAX(sale_date) as latest_date,
    SUM(units_sold) as total_units,
    SUM(net_revenue) as total_revenue
FROM amazon_financial_daily_sales 
WHERE sku LIKE '%MQ20%'
GROUP BY sku
ORDER BY sku;

-- 4. Check if MQ20-D80W-U has any sales data
SELECT 
    sku,
    sale_date,
    units_sold,
    net_revenue,
    orders
FROM amazon_financial_daily_sales 
WHERE sku = 'MQ20-D80W-U'
ORDER BY sale_date DESC
LIMIT 10;
