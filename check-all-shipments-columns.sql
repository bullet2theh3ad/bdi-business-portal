-- Check ALL columns in shipments table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shipments'
ORDER BY ordinal_position;

