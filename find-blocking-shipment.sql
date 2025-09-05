-- Find the actual shipment blocking forecast deletion
-- Run this in Supabase SQL Editor

-- 1. Check the actual shipments table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shipments' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Find any shipment with forecast_id = 512daf0c-defa-405c-bf2d-f293dc04a987
-- Using only basic columns that should exist
SELECT 
  id,
  forecast_id,
  created_at
FROM shipments 
WHERE forecast_id = '512daf0c-defa-405c-bf2d-f293dc04a987';

-- 3. Show all shipments to see the data
SELECT 
  id,
  forecast_id,
  created_at
FROM shipments 
ORDER BY created_at DESC
LIMIT 10;
