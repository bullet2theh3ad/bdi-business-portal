-- Check if MT7711-10 mapping exists for EMG warehouse
SELECT 
    'sku_mappings_for_mt7711' as table_name,
    sm.external_identifier,
    sm.channel,
    ps.sku as internal_sku,
    ps.name as internal_sku_name,
    sm.notes
FROM sku_mappings sm
JOIN product_skus ps ON sm.internal_sku_id = ps.id
WHERE sm.external_identifier = 'MT7711-10';
