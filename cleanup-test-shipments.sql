-- Clean up test shipments before testing the new one-shipment-per-forecast logic

-- First, let's see what we have
SELECT 
  id,
  shipment_number,
  forecast_id,
  status,
  created_at,
  notes
FROM shipments 
ORDER BY created_at DESC;

-- Delete all test shipments (and their related documents will cascade)
-- This will give us a clean slate to test the new logic
DELETE FROM shipments;

-- Verify cleanup
SELECT COUNT(*) as remaining_shipments FROM shipments;

-- Also clean up any orphaned shipment documents
DELETE FROM shipment_documents WHERE shipment_id NOT IN (SELECT id FROM shipments);

-- Final verification
SELECT 
  (SELECT COUNT(*) FROM shipments) as shipments_count,
  (SELECT COUNT(*) FROM shipment_documents) as documents_count;
