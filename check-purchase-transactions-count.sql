-- 2. Check Purchase Transactions (checks, credit cards, etc.) Summary
SELECT 
  'Purchase Transactions' as entity_type,
  COUNT(*) as total_count,
  COUNT(DISTINCT vendor_name) as unique_vendors,
  MIN(expense_date) as earliest_date,
  MAX(expense_date) as latest_date,
  SUM(total_amount) as total_amount
FROM quickbooks_expenses;

