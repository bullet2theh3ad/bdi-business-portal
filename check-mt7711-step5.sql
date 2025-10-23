-- Step 5: Check if MT7711-10 exists in warehouse data
SELECT 
    'warehouse_wip_units' as table_name,
    model_number,
    COUNT(*) as unit_count,
    COUNT(DISTINCT serial_number) as unique_units
FROM warehouse_wip_units 
WHERE model_number = 'MT7711-10'
GROUP BY model_number;
