-- Debug approved invoice PDF issue
-- Invoice: INV-9002002811916-2025-0996

-- Check if invoice exists and has approved_pdf_url
SELECT 
  id,
  invoice_number,
  status,
  approved_pdf_url,
  created_at,
  updated_at
FROM invoices
WHERE invoice_number = 'INV-9002002811916-2025-0996';

-- Check all invoices with approved status
SELECT 
  invoice_number,
  status,
  approved_pdf_url,
  LENGTH(approved_pdf_url) as path_length,
  updated_at
FROM invoices
WHERE status = 'approved_by_finance'
ORDER BY updated_at DESC
LIMIT 10;

-- Check if there are any NULL approved_pdf_url for approved invoices
SELECT COUNT(*) as approved_without_pdf
FROM invoices
WHERE status = 'approved_by_finance' 
  AND (approved_pdf_url IS NULL OR approved_pdf_url = '');

