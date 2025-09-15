-- Debug shipment status update issue for MNQ1525-30W-U-(HSN)

-- STEP 1: Find the shipment record
SELECT 
  'SHIPMENT CHECK' as check_type,
  id,
  shipment_number,
  forecast_id,
  status,
  sales_signal,
  factory_signal,
  shipping_signal,
  transit_signal,
  warehouse_signal,
  notes,
  created_at,
  updated_at
FROM shipments 
WHERE shipment_number LIKE '%MNQ1525%' 
   OR notes LIKE '%MNQ1525%'
   OR id IN (
     SELECT id FROM shipments WHERE forecast_id IN (
       SELECT id FROM sales_forecasts WHERE sku LIKE '%MNQ1525%'
     )
   )
ORDER BY created_at DESC
LIMIT 5;

-- STEP 2: Check related forecast
SELECT 
  'FORECAST CHECK' as check_type,
  id,
  sku,
  status,
  sales_signal,
  factory_signal,
  shipping_signal,
  transit_signal,
  warehouse_signal,
  notes,
  created_at,
  updated_at
FROM sales_forecasts 
WHERE sku LIKE '%MNQ1525%' 
   OR sku LIKE '%Q15%'
ORDER BY created_at DESC
LIMIT 5;

-- STEP 3: Check if there are any database constraints or triggers that might be failing
SELECT 
  'TABLE INFO' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'shipments' 
  AND column_name IN ('transit_signal', 'notes', 'status', 'updated_at')
ORDER BY column_name;

-- STEP 4: Test a simple update to see if it works
-- (Uncomment to test)
/*
UPDATE shipments 
SET 
  transit_signal = 'pending',
  notes = COALESCE(notes, '') || CASE WHEN notes IS NOT NULL AND notes != '' THEN E'\n' ELSE '' END || '[2025-09-13] TRANSIT → pending: JJOLM255014 - added from OL-USA',
  updated_at = NOW()
WHERE shipment_number LIKE '%MNQ1525%' 
   OR id IN (
     SELECT id FROM shipments WHERE forecast_id IN (
       SELECT id FROM sales_forecasts WHERE sku LIKE '%MNQ1525%'
     )
   );
*/

-- STEP 5: Check for any RLS (Row Level Security) policies that might block updates
SELECT 
  'RLS POLICIES' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'shipments';

-- This will help identify what's blocking the status update
