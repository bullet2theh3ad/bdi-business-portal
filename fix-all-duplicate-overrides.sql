-- ============================================================================
-- FIX ALL DUPLICATE OVERRIDES
-- ============================================================================
-- This deletes duplicate overrides, keeping only the NEWEST one for each transaction
-- Current duplicates: 46 records (Labor: 22, OpEx: 19, Inventory: 5)
--
-- SAFE: Only deletes older duplicates, keeps the most recent categorization
-- ============================================================================

-- ============================================================================
-- STEP 1: PREVIEW - What will be deleted
-- ============================================================================
-- Shows all the duplicate records that will be DELETED (older ones)
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
  transaction_source,
  transaction_id,
  line_item_index,
  override_category,
  override_account_type,
  updated_at,
  'WILL BE DELETED' as status
FROM ranked_overrides
WHERE rn > 1
ORDER BY override_category, transaction_source, transaction_id, updated_at;

-- ============================================================================
-- STEP 2: Count how many will be deleted
-- ============================================================================
WITH ranked_overrides AS (
  SELECT 
    id,
    override_category,
    ROW_NUMBER() OVER (
      PARTITION BY transaction_source, transaction_id, line_item_index 
      ORDER BY updated_at DESC
    ) as rn
  FROM gl_transaction_overrides
)
SELECT 
  override_category,
  COUNT(*) as duplicates_to_delete
FROM ranked_overrides
WHERE rn > 1
GROUP BY override_category
UNION ALL
SELECT 
  'TOTAL' as override_category,
  COUNT(*) as duplicates_to_delete
FROM ranked_overrides
WHERE rn > 1;

-- ============================================================================
-- STEP 3: DELETE DUPLICATES (Run this after reviewing preview)
-- ============================================================================
-- This keeps the NEWEST override and deletes all older ones
DELETE FROM gl_transaction_overrides
WHERE id IN (
  WITH ranked_overrides AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY transaction_source, transaction_id, line_item_index 
        ORDER BY updated_at DESC
      ) as rn
    FROM gl_transaction_overrides
  )
  SELECT id
  FROM ranked_overrides
  WHERE rn > 1
);

-- ============================================================================
-- STEP 4: VERIFY - Check for remaining duplicates
-- ============================================================================
-- Should return 0 rows after cleanup
SELECT 
  transaction_source,
  transaction_id,
  line_item_index,
  COUNT(*) as duplicate_count
FROM gl_transaction_overrides
GROUP BY transaction_source, transaction_id, line_item_index
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- ============================================================================
-- STEP 5: Summary - Final override counts by category
-- ============================================================================
SELECT 
  override_category,
  COUNT(*) as total_overrides,
  COUNT(DISTINCT (transaction_source || ':' || transaction_id || ':' || COALESCE(line_item_index::text, 'null'))) as unique_transactions,
  CASE 
    WHEN COUNT(*) = COUNT(DISTINCT (transaction_source || ':' || transaction_id || ':' || COALESCE(line_item_index::text, 'null'))) 
    THEN '✅ All Unique'
    ELSE '🚩 Still has duplicates'
  END as status
FROM gl_transaction_overrides
GROUP BY override_category
ORDER BY override_category;

