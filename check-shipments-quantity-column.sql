-- Check the actual column name for quantity in shipments table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shipments'
  AND column_name LIKE '%quantity%'
ORDER BY ordinal_position;

