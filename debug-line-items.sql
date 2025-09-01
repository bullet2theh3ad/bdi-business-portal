-- Debug query to check if line items exist for invoices
-- Run this in Supabase SQL Editor to verify data

-- 1. Check if invoices exist
SELECT 
  id,
  invoice_number,
  customer_name,
  total_value,
  created_at
FROM invoices 
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check if line items exist
SELECT 
  ili.id,
  ili.invoice_id,
  ili.sku_code,
  ili.sku_name,
  ili.quantity,
  ili.unit_cost,
  ili.line_total,
  i.invoice_number
FROM invoice_line_items ili
JOIN invoices i ON ili.invoice_id = i.id
ORDER BY ili.created_at DESC
LIMIT 10;

-- 3. Check specific invoice line items (replace with your invoice ID)
SELECT 
  ili.*,
  i.invoice_number
FROM invoice_line_items ili
JOIN invoices i ON ili.invoice_id = i.id
WHERE ili.invoice_id = '5c74249d-3438-4ba4-a2e0-6c74d6ad9f84'  -- Replace with actual invoice ID
ORDER BY ili.created_at;

-- 4. Count line items per invoice
SELECT 
  i.invoice_number,
  i.customer_name,
  COUNT(ili.id) as line_item_count
FROM invoices i
LEFT JOIN invoice_line_items ili ON i.id = ili.invoice_id
GROUP BY i.id, i.invoice_number, i.customer_name
ORDER BY i.created_at DESC;
