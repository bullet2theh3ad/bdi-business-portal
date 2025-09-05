-- Debug what's preventing forecast deletion
-- Run this in Supabase SQL Editor to find all references to a specific forecast

-- Replace 'FORECAST_ID_HERE' with the actual forecast ID that won't delete
-- You can get the forecast ID from the browser console or by checking the forecast details

-- 1. Check the forecast exists and get basic info
SELECT 
  id,
  sku_id,
  delivery_week,
  quantity,
  status,
  created_at
FROM sales_forecasts 
WHERE id = 'FORECAST_ID_HERE';

-- 2. Check shipments that reference this forecast
SELECT 
  id,
  forecast_id,
  shipping_organization_code,
  shipper_reference,
  bdi_reference,
  status,
  created_at
FROM shipments 
WHERE forecast_id = 'FORECAST_ID_HERE';

-- 3. Check production files that reference this forecast
SELECT 
  id,
  file_name,
  forecast_id,
  bdi_shipment_number,
  organization_id,
  created_at
FROM production_files 
WHERE forecast_id = 'FORECAST_ID_HERE';

-- 4. Check any other tables that might reference forecasts
-- Look for any foreign key constraints
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'sales_forecasts';

-- 5. Check if there are any other references in the database
-- This is a broader search for any column that might contain the forecast ID
SELECT 
  schemaname,
  tablename,
  attname as column_name,
  typname as data_type
FROM pg_stats 
WHERE schemaname = 'public' 
  AND (attname LIKE '%forecast%' OR attname LIKE '%forecast_id%')
ORDER BY tablename, attname;
