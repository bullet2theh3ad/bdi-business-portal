-- 1. Check Purchase Orders (POs) Summary
SELECT 
  'Purchase Orders' as entity_type,
  COUNT(*) as total_count,
  COUNT(DISTINCT vendor_name) as unique_vendors,
  MIN(txn_date) as earliest_date,
  MAX(txn_date) as latest_date,
  SUM(total_amount) as total_amount
FROM quickbooks_purchase_orders_qb;

