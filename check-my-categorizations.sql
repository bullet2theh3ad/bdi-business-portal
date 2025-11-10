-- Check all your recent categorizations
-- This shows what you've assigned to each category

-- Summary by category and account type
SELECT 
  override_category as category,
  COALESCE(override_account_type, 'NULL') as account_type,
  COUNT(*) as count,
  SUM(CASE 
    WHEN transaction_source IN ('expense', 'bill', 'bill_payment') THEN 1 
    WHEN transaction_source IN ('payment', 'deposit') THEN -1 
    ELSE 0 
  END) as net_transactions
FROM gl_transaction_overrides
WHERE override_category IS NOT NULL
GROUP BY override_category, override_account_type
ORDER BY override_category, count DESC;

-- Recent categorizations (last 50)
SELECT 
  override_category,
  override_account_type,
  transaction_source,
  transaction_id,
  created_at,
  updated_at
FROM gl_transaction_overrides
WHERE override_category IS NOT NULL
ORDER BY updated_at DESC
LIMIT 50;

-- Count by each category
SELECT 
  COALESCE(override_category, 'NULL') as category,
  COUNT(*) as total_count
FROM gl_transaction_overrides
GROUP BY override_category
ORDER BY total_count DESC;

