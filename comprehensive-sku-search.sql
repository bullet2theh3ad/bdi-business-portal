-- Comprehensive search for MQ20-D80W-U across ALL tables
-- Run this in Supabase SQL Editor

-- 1. Check if MQ20-D80W-U exists in product_skus (should exist)
SELECT sku, name, description, created_at
FROM product_skus 
WHERE sku = 'MQ20-D80W-U';

-- 2. Check ALL Amazon-related tables for MQ20-D80W-U
SELECT 'amazon_financial_line_items' as table_name, COUNT(*) as count
FROM amazon_financial_line_items 
WHERE bdi_sku = 'MQ20-D80W-U'
UNION ALL
SELECT 'amazon_financial_summaries' as table_name, COUNT(*) as count
FROM amazon_financial_summaries 
WHERE bdi_sku = 'MQ20-D80W-U'
UNION ALL
SELECT 'amazon_inventory_summaries' as table_name, COUNT(*) as count
FROM amazon_inventory_summaries 
WHERE bdi_sku = 'MQ20-D80W-U'
UNION ALL
SELECT 'amazon_financial_daily_sales' as table_name, COUNT(*) as count
FROM amazon_financial_daily_sales 
WHERE sku = 'MQ20-D80W-U';

-- 3. Check for similar SKUs in amazon_financial_line_items
SELECT 'amazon_financial_line_items' as table_name, bdi_sku, amazon_sku, COUNT(*) as records
FROM amazon_financial_line_items 
WHERE bdi_sku LIKE '%MQ20%' OR amazon_sku LIKE '%MQ20%'
GROUP BY bdi_sku, amazon_sku
ORDER BY bdi_sku;

-- 4. Check for similar SKUs in amazon_financial_daily_sales
SELECT 'amazon_financial_daily_sales' as table_name, sku as bdi_sku, COUNT(*) as records
FROM amazon_financial_daily_sales 
WHERE sku LIKE '%MQ20%'
GROUP BY sku
ORDER BY sku;

-- 5. Check if there are any recent Amazon data imports
SELECT 
    id,
    import_date,
    status,
    total_records,
    created_at
FROM amazon_financial_imports 
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Check what SKUs are actually being used in Sales Velocity
-- This will show us what the Sales Velocity API is currently finding
SELECT DISTINCT bdi_sku, COUNT(*) as records
FROM amazon_financial_line_items 
WHERE bdi_sku IS NOT NULL
ORDER BY records DESC
LIMIT 20;
