-- Check for duplicate overrides for payment:2043
SELECT 
  id,
  transaction_source,
  transaction_id,
  line_item_index,
  override_category,
  override_account_type,
  created_at,
  updated_at
FROM gl_transaction_overrides
WHERE transaction_source = 'payment'
  AND transaction_id = '2043'
ORDER BY updated_at DESC;

-- Check for ALL duplicate overrides (same transaction + line item)
SELECT 
  transaction_source,
  transaction_id,
  line_item_index,
  COUNT(*) as duplicate_count,
  STRING_AGG(override_account_type::text, ', ' ORDER BY updated_at DESC) as account_types,
  STRING_AGG(id::text, ', ' ORDER BY updated_at DESC) as ids
FROM gl_transaction_overrides
GROUP BY transaction_source, transaction_id, line_item_index
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 20;

