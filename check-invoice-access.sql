-- Check what invoices exist and their customer names
SELECT 
  id,
  invoice_number,
  customer_name,
  total_value,
  status,
  created_at
FROM invoices
ORDER BY created_at DESC;

-- Check if TC1 should only see specific invoices
SELECT DISTINCT customer_name FROM invoices;
