-- Check the actual shipments table structure
-- Run this in Supabase SQL Editor

-- 1. Check if the shipments table exists and its columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'shipments'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. If shipments table exists, check for the specific forecast
SELECT 
  id,
  forecast_id,
  created_at
FROM shipments 
WHERE forecast_id = '512daf0c-defa-405c-bf2d-f293dc04a987'
LIMIT 5;

-- 3. Check if the forecast exists in sales_forecasts table
SELECT 
  id,
  sku_id,
  delivery_week,
  quantity,
  status,
  created_at
FROM sales_forecasts 
WHERE id = '512daf0c-defa-405c-bf2d-f293dc04a987';

-- 4. Try to manually delete the forecast to see the exact error
-- DELETE FROM sales_forecasts WHERE id = '512daf0c-defa-405c-bf2d-f293dc04a987';
-- (Uncomment the line above to test, but be careful!)
