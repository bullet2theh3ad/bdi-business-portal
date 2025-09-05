-- Find tables that reference sales_forecasts (incoming foreign keys)
-- Run this in Supabase SQL Editor

-- 1. Find all foreign key constraints that reference sales_forecasts
SELECT
  tc.table_name as referencing_table,
  kcu.column_name as referencing_column,
  tc.constraint_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'sales_forecasts'
  AND ccu.column_name = 'id';

-- 2. Check production_files table specifically
SELECT 
  id,
  file_name,
  forecast_id,
  organization_id,
  created_at
FROM production_files 
WHERE forecast_id = '512daf0c-defa-405c-bf2d-f293dc04a987';

-- 3. Check if shipments table exists and what it contains
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'shipments'
) as shipments_table_exists;

-- 4. If shipments exists, check its structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shipments' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Check for any UUID columns in shipments that might reference forecasts
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipments' 
  AND table_schema = 'public'
  AND data_type = 'character varying'
ORDER BY ordinal_position;
