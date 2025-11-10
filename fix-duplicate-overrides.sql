-- FIX: Remove duplicate overrides, keeping only the most recent one
-- This will delete older duplicates for each (transaction_source, transaction_id, line_item_index) combination

-- PREVIEW what will be deleted (run this first!)
WITH ranked_overrides AS (
  SELECT 
    id,
    transaction_source,
    transaction_id,
    line_item_index,
    override_category,
    override_account_type,
    updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY transaction_source, transaction_id, line_item_index 
      ORDER BY updated_at DESC
    ) as rn
  FROM gl_transaction_overrides
)
SELECT 
  id,
  transaction_source || ':' || transaction_id || ':' || COALESCE(line_item_index::text, '') as key,
  override_category,
  override_account_type,
  updated_at,
  'WILL BE DELETED' as action
FROM ranked_overrides
WHERE rn > 1
ORDER BY transaction_source, transaction_id, line_item_index, updated_at DESC;

-- UNCOMMENT TO DELETE DUPLICATES (after previewing above):
/*
WITH ranked_overrides AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY transaction_source, transaction_id, line_item_index 
      ORDER BY updated_at DESC
    ) as rn
  FROM gl_transaction_overrides
)
DELETE FROM gl_transaction_overrides
WHERE id IN (
  SELECT id FROM ranked_overrides WHERE rn > 1
);

-- After delete, show summary:
SELECT 
  'Duplicates removed' as status,
  COUNT(*) as remaining_overrides
FROM gl_transaction_overrides;
*/

