-- Check if shipment priority and shipper_reference are saving
-- Run this in Supabase SQL Editor

-- 1. Check the actual shipments table structure for these fields
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shipments' AND table_schema = 'public'
  AND (column_name LIKE '%priority%' OR column_name LIKE '%reference%')
ORDER BY ordinal_position;

-- 2. Check the specific shipment that was just updated
SELECT 
  id,
  shipment_number,
  forecast_id,
  priority,
  shipper_reference,
  notes,
  updated_at
FROM shipments 
WHERE id = 'ebbd6c71-088b-4e3e-b39e-b6622e1fb951';

-- 3. Check all shipments to see if these fields exist
SELECT 
  id,
  shipment_number,
  priority,
  shipper_reference,
  created_at
FROM shipments 
ORDER BY created_at DESC
LIMIT 5;
