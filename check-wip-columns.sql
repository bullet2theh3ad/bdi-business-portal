-- Check warehouse_wip_units table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'warehouse_wip_units' 
ORDER BY ordinal_position;

-- Sample data to see actual column names
SELECT * FROM warehouse_wip_units LIMIT 1;

