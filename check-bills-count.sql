-- 3. Check Bills (vendor invoices) Summary
SELECT 
  'Bills' as entity_type,
  COUNT(*) as total_count,
  COUNT(DISTINCT vendor_name) as unique_vendors,
  MIN(bill_date) as earliest_date,
  MAX(bill_date) as latest_date,
  SUM(total_amount) as total_amount
FROM quickbooks_bills;

