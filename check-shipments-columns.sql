-- Check exact column names in shipments table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shipments' 
ORDER BY ordinal_position;
