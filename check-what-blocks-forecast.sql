-- Find what's actually blocking the forecast deletion
-- Run this in Supabase SQL Editor

-- 1. Find all tables that have foreign keys pointing to sales_forecasts
SELECT
  tc.table_name as referencing_table,
  kcu.column_name as referencing_column,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'sales_forecasts'
  AND ccu.column_name = 'id';

-- 2. Check production_files specifically for this forecast
SELECT 
  id,
  file_name,
  forecast_id,
  organization_id,
  created_at
FROM production_files 
WHERE forecast_id = '512daf0c-defa-405c-bf2d-f293dc04a987';

-- 3. Try to manually delete and see the exact error
-- DELETE FROM sales_forecasts WHERE id = '512daf0c-defa-405c-bf2d-f293dc04a987';
-- ^^ UNCOMMENT this line to see the exact error message
