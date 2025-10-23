-- Debug MT7711-10 SKU mapping issue
-- This script will help identify why MT7711-10 is missing from Sales Velocity

-- 1. Check if MT7711-10 exists in amazon_financial_transactions
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

-- 2. Check if MT7711-10 exists in product_skus table
SELECT 
    'product_skus' as table_name,
    sku,
    name,
    mfg,
    is_active,
    created_at
FROM product_skus 
WHERE sku = 'MT7711-10';

-- 3. Check if there are any SKU mappings for MT7711-10
SELECT 
    'sku_mappings' as table_name,
    sm.external_identifier,
    sm.channel,
    ps.sku as internal_sku,
    ps.name as internal_sku_name,
    sm.notes
FROM sku_mappings sm
JOIN product_skus ps ON sm.internal_sku_id = ps.id
WHERE ps.sku = 'MT7711-10';

-- 4. Check if there are any Amazon SKUs that might map to MT7711-10
SELECT 
    'reverse_mapping_check' as table_name,
    sm.external_identifier as amazon_sku,
    sm.channel,
    ps.sku as bdi_sku,
    ps.name as bdi_sku_name
FROM sku_mappings sm
JOIN product_skus ps ON sm.internal_sku_id = ps.id
WHERE sm.external_identifier LIKE '%MT7711%' 
   OR sm.external_identifier LIKE '%7711%'
   OR ps.sku = 'MT7711-10';

-- 5. Check what Amazon SKUs exist that might be related to MT7711-10
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

-- 6. Check if MT7711-10 exists in warehouse data
SELECT 
    'warehouse_wip_units' as table_name,
    model_number,
    COUNT(*) as unit_count,
    COUNT(DISTINCT serial_number) as unique_units
FROM warehouse_wip_units 
WHERE model_number = 'MT7711-10'
GROUP BY model_number;

-- 7. Check if MT7711-10 exists in Amazon inventory (checking available tables first)
-- First, let's see what Amazon tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%amazon%'
ORDER BY table_name;
