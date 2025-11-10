-- Check revenue overrides and their account types
-- This will show us if the override_account_type column is actually populated

SELECT 
  transaction_source,
  transaction_id,
  override_category,
  override_account_type,
  CASE 
    WHEN override_account_type IS NULL THEN 'MISSING ❌'
    ELSE 'HAS VALUE ✅'
  END as status,
  updated_at
FROM gl_transaction_overrides
WHERE override_category = 'revenue'
ORDER BY updated_at DESC
LIMIT 30;

-- Summary count
SELECT 
  CASE 
    WHEN override_account_type IS NULL THEN 'MISSING'
    ELSE override_account_type
  END as account_type_status,
  COUNT(*) as count
FROM gl_transaction_overrides
WHERE override_category = 'revenue'
GROUP BY account_type_status
ORDER BY count DESC;

