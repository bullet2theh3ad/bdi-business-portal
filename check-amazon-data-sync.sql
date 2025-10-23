-- Check if MQ20-D80W-U exists in Amazon Financial data but not in line items table
-- Run this in Supabase SQL Editor

-- 1. Check if the SKU exists in any Amazon-related tables
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
WHERE bdi_sku = 'MQ20-D80W-U';

-- 2. Check what Amazon SKU is mapped to MQ20-D80W-U
SELECT 
    bdi_sku,
    amazon_sku,
    COUNT(*) as transaction_count,
    MIN(posted_date) as first_transaction,
    MAX(posted_date) as last_transaction
FROM amazon_financial_line_items 
WHERE bdi_sku LIKE '%MQ20%'
GROUP BY bdi_sku, amazon_sku
ORDER BY bdi_sku;

-- 3. Check if there are any recent Amazon data imports
SELECT 
    id,
    import_date,
    status,
    total_records,
    created_at
FROM amazon_financial_imports 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. Check if MQ20-D80W-U exists in product_skus table
SELECT 
    sku,
    name,
    description,
    created_at
FROM product_skus 
WHERE sku = 'MQ20-D80W-U';

-- 5. Check for similar SKUs that might be the same product
SELECT 
    sku,
    name,
    description,
    created_at
FROM product_skus 
WHERE sku LIKE '%MQ20%'
ORDER BY sku;
