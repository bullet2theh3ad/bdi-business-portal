-- Bulk update: Change all Net Revenue items to "D2C Sales"
-- This updates all transactions you've categorized as revenue (Shopify, Walmart, Amazon, etc.)

-- First, let's see what we currently have
SELECT 
  transaction_source,
  transaction_id,
  override_category,
  override_account_type,
  created_at
FROM gl_transaction_overrides
WHERE override_category = 'revenue'
ORDER BY created_at DESC
LIMIT 20;

-- Show count of what needs updating
SELECT 
  COALESCE(override_account_type, 'NULL') as current_account_type,
  COUNT(*) as count
FROM gl_transaction_overrides
WHERE override_category = 'revenue'
GROUP BY override_account_type;

-- Update ALL revenue items to "D2C Sales"
UPDATE gl_transaction_overrides
SET 
  override_account_type = 'D2C Sales',
  updated_at = NOW()
WHERE override_category = 'revenue';

-- Verify the update worked
SELECT 
  override_category,
  override_account_type,
  COUNT(*) as count
FROM gl_transaction_overrides
WHERE override_category = 'revenue'
GROUP BY override_category, override_account_type;

-- Show some examples of updated records
SELECT 
  transaction_source,
  transaction_id,
  override_category,
  override_account_type,
  updated_at
FROM gl_transaction_overrides
WHERE override_category = 'revenue'
ORDER BY updated_at DESC
LIMIT 10;

