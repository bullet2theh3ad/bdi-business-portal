-- Step 2: Check if MT7711-10 exists in product_skus table
SELECT 
    'product_skus' as table_name,
    sku,
    name,
    mfg,
    is_active,
    created_at
FROM product_skus 
WHERE sku = 'MT7711-10';