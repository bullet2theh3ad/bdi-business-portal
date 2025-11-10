-- ============================================================================
-- CHECK FOR DUPLICATE OVERRIDES
-- ============================================================================
-- This finds any transaction that has multiple override entries
-- (which causes the "Unassigned" revert issue)

-- ============================================================================
-- STEP 1: Find ALL duplicates (shows which transactions have 2+ overrides)
-- ============================================================================
SELECT 
  transaction_source,
  transaction_id,
  line_item_index,
  COUNT(*) as duplicate_count,
  STRING_AGG(DISTINCT override_account_type, ', ' ORDER BY override_account_type) as account_types,
  STRING_AGG(id::text, ', ') as override_ids
FROM gl_transaction_overrides
GROUP BY transaction_source, transaction_id, line_item_index
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, transaction_source, transaction_id;

-- ============================================================================
-- STEP 2: Count how many transactions have duplicates
-- ============================================================================
SELECT 
  'Total Transactions with Duplicates' as summary,
  COUNT(*) as count
FROM (
  SELECT 
    transaction_source,
    transaction_id,
    line_item_index
  FROM gl_transaction_overrides
  GROUP BY transaction_source, transaction_id, line_item_index
  HAVING COUNT(*) > 1
) duplicates;

-- ============================================================================
-- STEP 3: Show detailed view of duplicates (full record details)
-- ============================================================================
SELECT 
  o.id,
  o.transaction_source,
  o.transaction_id,
  o.line_item_index,
  o.override_category,
  o.override_account_type,
  o.notes,
  o.created_at,
  o.updated_at,
  'DUPLICATE' as status
FROM gl_transaction_overrides o
WHERE (transaction_source, transaction_id, line_item_index) IN (
  SELECT transaction_source, transaction_id, line_item_index
  FROM gl_transaction_overrides
  GROUP BY transaction_source, transaction_id, line_item_index
  HAVING COUNT(*) > 1
)
ORDER BY transaction_source, transaction_id, line_item_index, updated_at DESC;

-- ============================================================================
-- STEP 4: Check YOUR recent categorizations for duplicates
-- ============================================================================
-- (Checks entries created/updated in the last 24 hours)
SELECT 
  transaction_source,
  transaction_id,
  line_item_index,
  COUNT(*) as duplicate_count,
  STRING_AGG(DISTINCT override_account_type, ', ' ORDER BY override_account_type) as account_types,
  MAX(updated_at) as most_recent_update
FROM gl_transaction_overrides
WHERE updated_at >= NOW() - INTERVAL '24 hours'
GROUP BY transaction_source, transaction_id, line_item_index
HAVING COUNT(*) > 1
ORDER BY most_recent_update DESC;

-- ============================================================================
-- STEP 5: Summary by category (how many duplicates in each category)
-- ============================================================================
SELECT 
  override_category,
  COUNT(DISTINCT (transaction_source || ':' || transaction_id || ':' || COALESCE(line_item_index::text, 'null'))) as unique_transactions,
  COUNT(*) as total_override_records,
  COUNT(*) - COUNT(DISTINCT (transaction_source || ':' || transaction_id || ':' || COALESCE(line_item_index::text, 'null'))) as duplicate_records
FROM gl_transaction_overrides
GROUP BY override_category
HAVING COUNT(*) > COUNT(DISTINCT (transaction_source || ':' || transaction_id || ':' || COALESCE(line_item_index::text, 'null')))
ORDER BY duplicate_records DESC;

