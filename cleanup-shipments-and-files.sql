-- Complete cleanup of shipments AND their storage files
-- This script cleans both database records and Supabase Storage files

-- Step 1: See what shipments and files we have
SELECT 
  s.id,
  s.shipment_number,
  s.forecast_id,
  s.status,
  s.created_at,
  COUNT(sd.id) as document_count
FROM shipments s 
LEFT JOIN shipment_documents sd ON s.id = sd.shipment_id
GROUP BY s.id, s.shipment_number, s.forecast_id, s.status, s.created_at
ORDER BY s.created_at DESC;

-- Step 2: List all shipment document file paths (so you can see what will be deleted)
SELECT 
  id,
  shipment_id,
  file_name,
  file_path,
  file_size
FROM shipment_documents 
ORDER BY file_name;

-- Step 3: Delete all shipment documents from database first (due to foreign keys)
DELETE FROM shipment_documents;

-- Step 4: Delete all shipments (this will cascade to any remaining related records)
DELETE FROM shipments;

-- Step 5: Verify database cleanup
SELECT 
  (SELECT COUNT(*) FROM shipments) as shipments_count,
  (SELECT COUNT(*) FROM shipment_documents) as documents_count,
  (SELECT COUNT(*) FROM shipment_line_items) as line_items_count,
  (SELECT COUNT(*) FROM shipment_tracking) as tracking_count;

-- IMPORTANT: For Supabase Storage file cleanup, you need to:
-- 1. Go to Supabase Dashboard > Storage > organization-documents bucket
-- 2. Navigate to folders like: 85a60a82-9d78-4cd9-85a1-e7e62cac552b/shipments/
-- 3. Delete the entire "shipments" folder and all subfolders
-- 
-- OR use the Supabase Storage API to delete programmatically:
-- (This would need to be run from a script or API endpoint)
-- 
-- Example paths to delete:
-- 85a60a82-9d78-4cd9-85a1-e7e62cac552b/shipments/eef2ccca-cd29-43e8-8d66-67eaf7e9471a/
-- 85a60a82-9d78-4cd9-85a1-e7e62cac552b/shipments/293af1d3-b802-4387-a8b7-b303615cc459/
-- etc.

-- Alternative: Create a simple API endpoint to clean up storage files
