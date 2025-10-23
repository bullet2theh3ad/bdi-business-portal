-- Check the actual column names in the shipments table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shipments'
ORDER BY ordinal_position;

-- Check if there are any shipments
SELECT COUNT(*) as total_shipments FROM shipments;

-- Check a sample shipment record
SELECT id, bdi_reference, shipper_reference, status
FROM shipments
LIMIT 5;
