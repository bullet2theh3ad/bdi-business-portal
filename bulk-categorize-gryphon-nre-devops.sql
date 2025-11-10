-- ============================================================================
-- BULK CATEGORIZE: Gryphon Online Safety, Inc. → NRE, DevOps
-- ============================================================================
-- This script categorizes ALL Gryphon Online Safety, Inc. transactions as NRE, DevOps
-- Note: All Gryphon transactions are DevOps-related work (confirmed via line_items analysis)
-- 
-- STEPS:
-- 1. Run the preview queries to see what will be affected
-- 2. Run the INSERT statements to create the overrides
-- 3. Run the verification query to confirm
-- ============================================================================

-- ============================================================================
-- STEP 1: PREVIEW - All Bills from Gryphon
-- ============================================================================
SELECT 
  'bill' as source_type,
  qb_bill_id as transaction_id,
  bill_date as date,
  vendor_name,
  total_amount
FROM quickbooks_bills
WHERE vendor_name ILIKE '%Gryphon Online Safety%'
ORDER BY bill_date DESC;

-- ============================================================================
-- STEP 2: PREVIEW - All Expenses from Gryphon
-- ============================================================================
SELECT 
  'expense' as source_type,
  qb_expense_id as transaction_id,
  expense_date as date,
  vendor_name,
  total_amount
FROM quickbooks_expenses
WHERE vendor_name ILIKE '%Gryphon Online Safety%'
ORDER BY expense_date DESC;

-- ============================================================================
-- STEP 3: PREVIEW - Summary Count
-- ============================================================================
SELECT 
  'Bills' as type,
  COUNT(*) as count,
  SUM(total_amount) as total_amount
FROM quickbooks_bills
WHERE vendor_name ILIKE '%Gryphon Online Safety%'
UNION ALL
SELECT 
  'Expenses' as type,
  COUNT(*) as count,
  SUM(total_amount) as total_amount
FROM quickbooks_expenses
WHERE vendor_name ILIKE '%Gryphon Online Safety%'
UNION ALL
SELECT 
  'TOTAL' as type,
  (SELECT COUNT(*) FROM quickbooks_bills WHERE vendor_name ILIKE '%Gryphon Online Safety%') +
  (SELECT COUNT(*) FROM quickbooks_expenses WHERE vendor_name ILIKE '%Gryphon Online Safety%') as count,
  COALESCE((SELECT SUM(total_amount) FROM quickbooks_bills WHERE vendor_name ILIKE '%Gryphon Online Safety%'), 0) +
  COALESCE((SELECT SUM(total_amount) FROM quickbooks_expenses WHERE vendor_name ILIKE '%Gryphon Online Safety%'), 0) as total_amount;

-- ============================================================================
-- STEP 4: CREATE OVERRIDES (Run this after reviewing preview)
-- ============================================================================
-- Note: Using your Supabase auth UUID as created_by
-- Replace with your actual UUID if different: 18a29c7a-3778-4ea9-a36b-eefabb93d1a3

-- Insert/Update overrides for Bills
INSERT INTO gl_transaction_overrides (
  transaction_source,
  transaction_id,
  line_item_index,
  override_category,
  override_account_type,
  notes,
  created_by,
  created_at,
  updated_at
)
SELECT 
  'bill',
  qb_bill_id,
  NULL,
  'nre',
  'DevOps',
  'Bulk categorized: Gryphon Online Safety - All DevOps work',
  '18a29c7a-3778-4ea9-a36b-eefabb93d1a3',
  NOW(),
  NOW()
FROM quickbooks_bills
WHERE vendor_name ILIKE '%Gryphon Online Safety%'
ON CONFLICT (transaction_source, transaction_id, line_item_index)
DO UPDATE SET
  override_category = EXCLUDED.override_category,
  override_account_type = EXCLUDED.override_account_type,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- Insert/Update overrides for Expenses
INSERT INTO gl_transaction_overrides (
  transaction_source,
  transaction_id,
  line_item_index,
  override_category,
  override_account_type,
  notes,
  created_by,
  created_at,
  updated_at
)
SELECT 
  'expense',
  qb_expense_id,
  NULL,
  'nre',
  'DevOps',
  'Bulk categorized: Gryphon Online Safety - All DevOps work',
  '18a29c7a-3778-4ea9-a36b-eefabb93d1a3',
  NOW(),
  NOW()
FROM quickbooks_expenses
WHERE vendor_name ILIKE '%Gryphon Online Safety%'
ON CONFLICT (transaction_source, transaction_id, line_item_index)
DO UPDATE SET
  override_category = EXCLUDED.override_category,
  override_account_type = EXCLUDED.override_account_type,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- ============================================================================
-- STEP 5: VERIFY - Check what was saved
-- ============================================================================
SELECT 
  transaction_source,
  transaction_id,
  override_category,
  override_account_type,
  notes,
  updated_at
FROM gl_transaction_overrides
WHERE notes LIKE '%Gryphon Online Safety%'
ORDER BY updated_at DESC;

-- ============================================================================
-- STEP 6: SUMMARY - Final count
-- ============================================================================
SELECT 
  'Gryphon Online Safety DevOps Categorized' as summary,
  COUNT(*) as transaction_count,
  SUM(
    CASE 
      WHEN transaction_source = 'bill' THEN (
        SELECT total_amount FROM quickbooks_bills 
        WHERE qb_bill_id = gl_transaction_overrides.transaction_id
      )
      WHEN transaction_source = 'expense' THEN (
        SELECT total_amount FROM quickbooks_expenses 
        WHERE qb_expense_id = gl_transaction_overrides.transaction_id
      )
    END
  ) as total_amount
FROM gl_transaction_overrides
WHERE notes LIKE '%Gryphon Online Safety%';
