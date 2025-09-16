-- DELETE SPECIFIC DUPLICATE INVOICES FOR PO_1005_Issoy
-- Keep the latest: 8a0e2257-a0af-4bb0-884c-30c5e98d8afb (2025-09-15 23:38:02)
-- Delete the older ones: 54d0b5ed-5b19-4676-a887-67782bddb04c and 4ff31282-80d6-46a5-9ec6-38388e281892

-- First, verify what we're about to delete
SELECT 
  id,
  invoice_number,
  customer_name,
  status,
  total_value,
  notes,
  created_at,
  CASE 
    WHEN id = '8a0e2257-a0af-4bb0-884c-30c5e98d8afb' THEN '✅ KEEP (Latest)'
    ELSE '❌ DELETE (Duplicate)'
  END as action
FROM invoices 
WHERE notes = 'Generated from PO: PO_1005_Issoy'
ORDER BY created_at DESC;

-- Delete the duplicate records (keeping the latest one)
DELETE FROM invoices 
WHERE id IN (
  '54d0b5ed-5b19-4676-a887-67782bddb04c',  -- Older duplicate
  '4ff31282-80d6-46a5-9ec6-38388e281892'   -- Oldest duplicate
);

-- Verify cleanup - should only show 1 record
SELECT 
  id,
  invoice_number,
  customer_name,
  status,
  created_at
FROM invoices 
WHERE notes = 'Generated from PO: PO_1005_Issoy'
ORDER BY created_at DESC;
