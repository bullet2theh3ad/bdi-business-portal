-- Simple check for MQ20-D80W-U in Amazon financial data
-- Run this in Supabase SQL Editor

-- 1. First, let's see what columns exist in the amazon_financial_line_items table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'amazon_financial_line_items' 
ORDER BY ordinal_position;

-- 2. Check if MQ20-D80W-U exists in amazon_financial_line_items
SELECT COUNT(*) as count
FROM amazon_financial_line_items 
WHERE bdi_sku = 'MQ20-D80W-U';

-- 3. Check what MQ20-related SKUs exist
SELECT DISTINCT bdi_sku, amazon_sku, COUNT(*) as transaction_count
FROM amazon_financial_line_items 
WHERE bdi_sku LIKE '%MQ20%'
GROUP BY bdi_sku, amazon_sku
ORDER BY bdi_sku;

-- 4. Check if MQ20-D80W-U exists in product_skus
SELECT sku, name, description
FROM product_skus 
WHERE sku = 'MQ20-D80W-U';

-- 5. Check all MQ20 SKUs in product_skus
SELECT sku, name, description
FROM product_skus 
WHERE sku LIKE '%MQ20%'
ORDER BY sku;
