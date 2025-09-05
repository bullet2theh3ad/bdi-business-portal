-- Check specific references for forecast 512daf0c-defa-405c-bf2d-f293dc04a987
-- Run this in Supabase SQL Editor

-- 1. Check production files referencing this forecast
SELECT 
  id,
  file_name,
  forecast_id,
  organization_id,
  created_at
FROM production_files 
WHERE forecast_id = '512daf0c-defa-405c-bf2d-f293dc04a987';

-- 2. Check if shipments table exists and has the forecast reference
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'shipments'
) as shipments_table_exists;

-- 3. If shipments table exists, check for references (adjust column names as needed)
-- First let's see the shipments table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'shipments' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Try a simple manual delete to see the exact error
-- UNCOMMENT THE LINE BELOW TO TEST (but be careful!)
-- DELETE FROM sales_forecasts WHERE id = '512daf0c-defa-405c-bf2d-f293dc04a987';

-- 5. Check all foreign key constraints on sales_forecasts table
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'sales_forecasts';
