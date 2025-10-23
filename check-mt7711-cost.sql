-- Check if MT7711-10-1 has cost data in product_skus
SELECT 
    'product_skus_cost' as table_name,
    sku,
    name,
    standard_cost,
    is_active,
    created_at
FROM product_skus 
WHERE sku = 'MT7711-10-1';
