-- ============================================
-- Bulk Categorize Gryphon Online Safety DevOps (GL Code 1150040007) as NRE, DevOps
-- ============================================

-- STEP 1: Preview QuickBooks Expenses from Gryphon with GL Code 1150040007
-- ============================================

SELECT 
  'EXPENSE' as source_type,
  qb_expense_id as transaction_id,
  vendor_name,
  expense_date as date,
  account_ref as gl_code,
  memo,
  total_amount
FROM quickbooks_expenses
WHERE vendor_name ILIKE '%Gryphon%'
  AND account_ref = '1150040007'
ORDER BY expense_date DESC;

-- ============================================
-- STEP 2: Preview QuickBooks Bills from Gryphon with GL Code 1150040007
-- ============================================

SELECT 
  'BILL' as source_type,
  qb_bill_id as transaction_id,
  vendor_name,
  bill_date as date,
  total_amount
FROM quickbooks_bills
WHERE vendor_name ILIKE '%Gryphon%'
ORDER BY bill_date DESC;

-- Note: Bills may have line items with different GL codes
-- We'll need to check if any bills have GL code 1150040007 in their line items

-- ============================================
-- STEP 3: Count total transactions to categorize
-- ============================================

SELECT 
  'Expenses with GL 1150040007' as type,
  COUNT(*) as count,
  SUM(total_amount::numeric) as total_amount
FROM quickbooks_expenses
WHERE vendor_name ILIKE '%Gryphon%'
  AND account_ref = '1150040007';

-- ============================================
-- STEP 4: Insert overrides for Gryphon Expenses (GL Code 1150040007)
-- ============================================

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
  'expense' as transaction_source,
  qb_expense_id::text as transaction_id,
  NULL as line_item_index,
  'nre' as override_category,
  'DevOps' as override_account_type,
  'Bulk categorized: Gryphon DevOps (GL 1150040007)' as notes,
  '18a29c7a-3778-4ea9-a36b-eefabb93d1a3' as created_by,
  NOW() as created_at,
  NOW() as updated_at
FROM quickbooks_expenses
WHERE vendor_name ILIKE '%Gryphon%'
  AND account_ref = '1150040007'
ON CONFLICT (transaction_source, transaction_id, line_item_index) 
DO UPDATE SET 
  override_category = 'nre',
  override_account_type = 'DevOps',
  notes = 'Bulk categorized: Gryphon DevOps (GL 1150040007)',
  updated_at = NOW();

-- ============================================
-- STEP 5: Verify the changes
-- ============================================

SELECT 
  transaction_source,
  transaction_id,
  override_category,
  override_account_type,
  notes,
  updated_at
FROM gl_transaction_overrides
WHERE notes LIKE '%Gryphon DevOps%'
ORDER BY updated_at DESC;

-- ============================================
-- STEP 6: Final summary
-- ============================================

SELECT 
  'Gryphon DevOps Categorized' as summary,
  COUNT(*) as transaction_count,
  SUM(e.total_amount::numeric) as total_amount
FROM quickbooks_expenses e
INNER JOIN gl_transaction_overrides o 
  ON o.transaction_source = 'expense' 
  AND o.transaction_id = e.qb_expense_id::text
WHERE o.notes LIKE '%Gryphon DevOps%';

