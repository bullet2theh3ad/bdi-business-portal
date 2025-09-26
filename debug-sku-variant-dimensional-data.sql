-- Debug SKU Variant Dimensional Data Issue
-- Compare parent SKU vs child variant to see what dimensional data is missing

-- First, let's see the parent SKU (MNQ1525-30W-U) dimensional data
SELECT 
    'PARENT SKU' as sku_type,
    sku,
    name,
    -- Box dimensions/weights
    box_length_cm,
    box_width_cm, 
    box_height_cm,
    box_weight_kg,
    -- Carton dimensions/weights
    carton_length_cm,
    carton_width_cm,
    carton_height_cm, 
    carton_weight_kg,
    boxes_per_carton,
    -- Pallet dimensions/weights
    pallet_length_cm,
    pallet_width_cm,
    pallet_height_cm,
    pallet_weight_kg,
    pallet_material_type,
    pallet_notes,
    -- Other key fields
    weight,
    dimensions,
    created_at,
    updated_at
FROM product_skus 
WHERE sku = 'MNQ1525-30W-U'

UNION ALL

-- Now let's see the child variant SKU (MNQ1525-30W-U-(LUV)) dimensional data
SELECT 
    'CHILD VARIANT' as sku_type,
    sku,
    name,
    -- Box dimensions/weights
    box_length_cm,
    box_width_cm, 
    box_height_cm,
    box_weight_kg,
    -- Carton dimensions/weights
    carton_length_cm,
    carton_width_cm,
    carton_height_cm, 
    carton_weight_kg,
    boxes_per_carton,
    -- Pallet dimensions/weights
    pallet_length_cm,
    pallet_width_cm,
    pallet_height_cm,
    pallet_weight_kg,
    pallet_material_type,
    pallet_notes,
    -- Other key fields
    weight,
    dimensions,
    created_at,
    updated_at
FROM product_skus 
WHERE sku LIKE 'MNQ1525-30W-U-(%)'
ORDER BY sku_type, sku;

-- Alternative: Show ALL MNQ1525-30W-U variants for comparison
-- SELECT 
--     sku,
--     name,
--     box_length_cm,
--     box_width_cm, 
--     box_height_cm,
--     box_weight_kg,
--     carton_length_cm,
--     carton_width_cm,
--     carton_height_cm, 
--     carton_weight_kg,
--     pallet_length_cm,
--     pallet_width_cm,
--     pallet_height_cm,
--     pallet_weight_kg,
--     created_at
-- FROM product_skus 
-- WHERE sku LIKE 'MNQ1525-30W-U%'
-- ORDER BY sku;

-- Check if there are any NULL vs 0 issues
SELECT 
    'DATA ANALYSIS' as analysis_type,
    sku,
    CASE 
        WHEN box_length_cm IS NULL THEN 'NULL'
        WHEN box_length_cm = 0 THEN 'ZERO'
        ELSE 'HAS_VALUE'
    END as box_length_status,
    CASE 
        WHEN box_weight_kg IS NULL THEN 'NULL'
        WHEN box_weight_kg = 0 THEN 'ZERO'
        ELSE 'HAS_VALUE'
    END as box_weight_status,
    CASE 
        WHEN carton_length_cm IS NULL THEN 'NULL'
        WHEN carton_length_cm = 0 THEN 'ZERO'
        ELSE 'HAS_VALUE'
    END as carton_length_status,
    CASE 
        WHEN pallet_length_cm IS NULL THEN 'NULL'
        WHEN pallet_length_cm = 0 THEN 'ZERO'
        ELSE 'HAS_VALUE'
    END as pallet_length_status
FROM product_skus 
WHERE sku LIKE 'MNQ1525-30W-U%'
ORDER BY sku;
