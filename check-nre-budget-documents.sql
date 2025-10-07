-- Check NRE Budget documents field
SELECT 
  id,
  nre_reference_number,
  vendor_name,
  documents,
  created_at,
  updated_at
FROM nre_budgets
ORDER BY created_at DESC
LIMIT 10;

-- Check if documents column exists and its type
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'nre_budgets' 
  AND column_name = 'documents';
