-- CLEANUP DUPLICATE INVOICES: Keep Latest, Delete Others
-- This identifies duplicate invoices based on PO reference and keeps only the most recent

-- First, let's see what duplicates exist
SELECT 
  notes,
  COUNT(*) as duplicate_count,
  array_agg(id ORDER BY created_at DESC) as invoice_ids,
  array_agg(invoice_number ORDER BY created_at DESC) as invoice_numbers,
  array_agg(created_at ORDER BY created_at DESC) as created_dates
FROM invoices 
WHERE notes LIKE 'Generated from PO:%'
GROUP BY notes
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- Show all invoices with PO references for review
SELECT 
  id,
  invoice_number,
  customer_name,
  status,
  total_value,
  notes,
  created_at
FROM invoices 
WHERE notes LIKE 'Generated from PO:%'
ORDER BY notes, created_at DESC;

-- CLEANUP SCRIPT (COMMENTED OUT FOR SAFETY)
-- Uncomment and run after reviewing the above results

/*
-- Delete duplicate invoices, keeping only the latest one for each PO
WITH duplicates_to_delete AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY notes ORDER BY created_at DESC) as rn
  FROM invoices 
  WHERE notes LIKE 'Generated from PO:%'
)
DELETE FROM invoices 
WHERE id IN (
  SELECT id FROM duplicates_to_delete WHERE rn > 1
);
*/

-- After cleanup, verify no duplicates remain
-- SELECT 
--   notes,
--   COUNT(*) as count
-- FROM invoices 
-- WHERE notes LIKE 'Generated from PO:%'
-- GROUP BY notes
-- HAVING COUNT(*) > 1;
