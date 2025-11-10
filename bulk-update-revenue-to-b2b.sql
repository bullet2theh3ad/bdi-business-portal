-- Bulk update: Change all Net Revenue items from "Unclassified" to "B2B Sales"
-- This updates all transactions you've categorized as revenue but haven't assigned a specific account type

-- First, let's see what we're about to update (preview)
SELECT 
  transaction_source,
  transaction_id,
  override_category,
  override_account_type,
  created_at
FROM gl_transaction_overrides
WHERE override_category = 'revenue'
  AND (override_account_type IS NULL OR override_account_type = 'Unclassified')
ORDER BY created_at DESC;

-- Show count
SELECT COUNT(*) as total_to_update
FROM gl_transaction_overrides
WHERE override_category = 'revenue'
  AND (override_account_type IS NULL OR override_account_type = 'Unclassified');

-- Now do the update
UPDATE gl_transaction_overrides
SET 
  override_account_type = 'B2B Sales',
  updated_at = NOW()
WHERE override_category = 'revenue'
  AND (override_account_type IS NULL OR override_account_type = 'Unclassified');

-- Verify the update
SELECT 
  override_category,
  override_account_type,
  COUNT(*) as count
FROM gl_transaction_overrides
WHERE override_category = 'revenue'
GROUP BY override_category, override_account_type
ORDER BY override_category, override_account_type;

