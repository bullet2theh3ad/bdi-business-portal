-- Check current state of revenue overrides in the database

-- Count by account type
SELECT 
  COALESCE(override_account_type, 'NULL') as account_type,
  COUNT(*) as count
FROM gl_transaction_overrides
WHERE override_category = 'revenue'
GROUP BY override_account_type
ORDER BY count DESC;

-- Show sample records (all should have D2C Sales now)
SELECT 
  transaction_source,
  transaction_id,
  override_category,
  override_account_type,
  updated_at
FROM gl_transaction_overrides
WHERE override_category = 'revenue'
ORDER BY updated_at DESC
LIMIT 20;

-- Double-check: are there ANY revenue records without D2C Sales?
SELECT 
  COUNT(*) as missing_account_type_count
FROM gl_transaction_overrides
WHERE override_category = 'revenue'
  AND (override_account_type IS NULL OR override_account_type != 'D2C Sales');

