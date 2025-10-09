-- Find the actual PDF file for invoice INV-9002002811916-2025-0996
-- Invoice ID: 045866e5-7f83-484a-b45f-e8037dc18202

-- The PDF should be at one of these paths in Supabase storage (organization-documents bucket):
-- Option 1: invoices/045866e5-7f83-484a-b45f-e8037dc18202/invoice-045866e5-7f83-484a-b45f-e8037dc18202-cfo-approval.pdf
-- Option 2: Check what's actually stored in the database

SELECT 
  id,
  invoice_number,
  status,
  approved_pdf_url,
  created_at,
  updated_at
FROM invoices
WHERE id = '045866e5-7f83-484a-b45f-e8037dc18202';

-- MANUAL FIX: Update the approved_pdf_url to the correct path
-- After confirming the file exists in Supabase storage, run this:

UPDATE invoices
SET approved_pdf_url = 'invoices/045866e5-7f83-484a-b45f-e8037dc18202/invoice-045866e5-7f83-484a-b45f-e8037dc18202-cfo-approval.pdf',
    updated_at = NOW()
WHERE id = '045866e5-7f83-484a-b45f-e8037dc18202';

-- Verify the update
SELECT 
  id,
  invoice_number,
  status,
  approved_pdf_url,
  updated_at
FROM invoices
WHERE id = '045866e5-7f83-484a-b45f-e8037dc18202';

