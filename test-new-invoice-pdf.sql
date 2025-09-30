-- Test the newly created invoice with fixed PDF URL storage
SELECT 
  id,
  invoice_number,
  status,
  approved_pdf_url,
  created_at,
  updated_at,
  notes
FROM invoices 
WHERE id = '41117644-cf44-4ed9-ae4a-c889f6507057'
ORDER BY created_at DESC;

-- Also check if any other invoices have PDF URLs now
SELECT 
  id,
  invoice_number,
  status,
  approved_pdf_url,
  CASE 
    WHEN approved_pdf_url IS NOT NULL THEN '✅ HAS PDF URL'
    ELSE '❌ NO PDF URL'
  END as pdf_status
FROM invoices 
WHERE status = 'approved_by_finance'
ORDER BY updated_at DESC;










