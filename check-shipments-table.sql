-- Check actual shipments table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'shipments' 
ORDER BY ordinal_position;

-- Check if there are any shipments in the database
SELECT 'SHIPMENT COUNT' as check, COUNT(*) as total_shipments
FROM shipments;

-- Check sample shipment data (use only basic columns)
SELECT 'SAMPLE SHIPMENTS' as check, id, created_at
FROM shipments 
LIMIT 3;