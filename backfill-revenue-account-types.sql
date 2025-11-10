-- Backfill missing account types for revenue overrides
-- This will set all revenue items without an account_type to "B2B Sales" as a default

-- First, let's see what we're about to update
SELECT 
  COUNT(*) as will_be_updated,
  'These revenue overrides will be set to B2B Sales' as note
FROM gl_transaction_overrides
WHERE override_category = 'revenue'
  AND (override_account_type IS NULL OR override_account_type = 'Unclassified');

-- UPDATE command (uncomment to run):
-- UPDATE gl_transaction_overrides
-- SET override_account_type = 'B2B Sales',
--     updated_at = NOW()
-- WHERE override_category = 'revenue'
--   AND (override_account_type IS NULL OR override_account_type = 'Unclassified');

-- After running the update, verify:
-- SELECT 
--   override_account_type,
--   COUNT(*) as count
-- FROM gl_transaction_overrides
-- WHERE override_category = 'revenue'
-- GROUP BY override_account_type;

