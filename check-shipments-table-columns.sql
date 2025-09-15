-- Check what columns actually exist in the shipments table

SELECT 
  'SHIPMENTS TABLE COLUMNS' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'shipments' 
  AND column_name LIKE '%signal%'
ORDER BY column_name;

-- Show ALL columns in shipments table
SELECT 
  'ALL SHIPMENTS COLUMNS' as check_type,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'shipments' 
ORDER BY ordinal_position;
