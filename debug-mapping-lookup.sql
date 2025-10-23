-- Debug the SKU mapping lookup logic
-- This simulates what the Warehouse Summary API does

-- 1. Get all SKU mappings (like the API does)
SELECT 
    'all_mappings' as step,
    sm.external_identifier,
    sm.channel,
    ps.sku as internal_sku,
    ps.name as internal_sku_name
FROM sku_mappings sm
LEFT JOIN product_skus ps ON sm.internal_sku_id = ps.id
WHERE sm.external_identifier = 'MT7711-10';

-- 2. Check if MT7711-10-1 has cost data
SELECT 
    'cost_check' as step,
    sku,
    standard_cost,
    is_active
FROM product_skus 
WHERE sku = 'MT7711-10-1';

-- 3. Check the exact mapping that should be found
SELECT 
    'mapping_lookup' as step,
    sm.external_identifier,
    sm.channel,
    ps.sku as internal_sku,
    ps.standard_cost,
    ps.is_active
FROM sku_mappings sm
JOIN product_skus ps ON sm.internal_sku_id = ps.id
WHERE sm.external_identifier = 'MT7711-10'
  AND ps.sku = 'MT7711-10-1';
