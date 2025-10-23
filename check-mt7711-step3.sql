-- Step 3: Check if there are any SKU mappings for MT7711-10
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
