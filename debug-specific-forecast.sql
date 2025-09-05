-- Debug what's preventing this specific forecast deletion
-- Run this in Supabase SQL Editor

-- The problematic forecast ID: 512daf0c-defa-405c-bf2d-f293dc04a987

-- 1. Verify the forecast exists
SELECT 
  id,
  sku_id,
  delivery_week,
  quantity,
  status,
  created_at
FROM sales_forecasts 
WHERE id = '512daf0c-defa-405c-bf2d-f293dc04a987';

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
WHERE forecast_id = '512daf0c-defa-405c-bf2d-f293dc04a987';

-- 3. Check production files that reference this forecast
SELECT 
  id,
  file_name,
  forecast_id,
  bdi_shipment_number,
  organization_id,
  created_at
FROM production_files 
WHERE forecast_id = '512daf0c-defa-405c-bf2d-f293dc04a987';

-- 4. Check for any other tables with foreign key references to sales_forecasts
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'sales_forecasts'
  AND ccu.column_name = 'id';

-- 5. Check if there are any direct references to this UUID in other varchar/text columns
-- This will help find non-foreign-key references that might be blocking deletion
SELECT 
  'shipments' as table_name,
  id,
  forecast_id,
  'forecast_id column' as reference_type
FROM shipments 
WHERE forecast_id = '512daf0c-defa-405c-bf2d-f293dc04a987'

UNION ALL

SELECT 
  'production_files' as table_name,
  id,
  forecast_id::text,
  'forecast_id column' as reference_type
FROM production_files 
WHERE forecast_id = '512daf0c-defa-405c-bf2d-f293dc04a987';
