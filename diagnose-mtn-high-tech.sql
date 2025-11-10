-- ============================================================================
-- DIAGNOSE: MTN High-Technology (HongKong) LTD
-- ============================================================================
-- Check why overrides can't be applied to this vendor

-- ============================================================================
-- STEP 1: Find all transactions for MTN High-Technology
-- ============================================================================

-- Check Bills
SELECT 
    'bill' as source,
    qb_bill_id as id,
    bill_date as date,
    vendor_name,
    total_amount,
    line_items
FROM quickbooks_bills
WHERE vendor_name LIKE '%MTN%'
   OR vendor_name LIKE '%High-Technology%'
ORDER BY bill_date DESC;

-- Check Expenses
SELECT 
    'expense' as source,
    qb_expense_id as id,
    expense_date as date,
    vendor_name,
    total_amount,
    line_items
FROM quickbooks_expenses
WHERE vendor_name LIKE '%MTN%'
   OR vendor_name LIKE '%High-Technology%'
ORDER BY expense_date DESC;

-- ============================================================================
-- STEP 2: Check existing overrides for MTN High-Technology
-- ============================================================================

-- Check overrides for Bills
SELECT 
    'EXISTING OVERRIDE' as status,
    o.transaction_source,
    o.transaction_id,
    o.line_item_index,
    o.override_category,
    o.override_account_type,
    o.notes,
    o.created_at,
    o.updated_at,
    b.vendor_name,
    b.total_amount
FROM gl_transaction_overrides o
LEFT JOIN quickbooks_bills b ON o.transaction_id = b.qb_bill_id::text
WHERE o.transaction_source = 'bill'
  AND (b.vendor_name LIKE '%MTN%' OR b.vendor_name LIKE '%High-Technology%')
ORDER BY o.updated_at DESC;

-- Check overrides for Expenses
SELECT 
    'EXISTING OVERRIDE' as status,
    o.transaction_source,
    o.transaction_id,
    o.line_item_index,
    o.override_category,
    o.override_account_type,
    o.notes,
    o.created_at,
    o.updated_at,
    e.vendor_name,
    e.total_amount
FROM gl_transaction_overrides o
LEFT JOIN quickbooks_expenses e ON o.transaction_id = e.qb_expense_id::text
WHERE o.transaction_source = 'expense'
  AND (e.vendor_name LIKE '%MTN%' OR e.vendor_name LIKE '%High-Technology%')
ORDER BY o.updated_at DESC;

-- ============================================================================
-- STEP 3: Check for duplicate overrides (this would prevent updates)
-- ============================================================================

-- Find any duplicate overrides for MTN transactions
SELECT 
    transaction_source,
    transaction_id,
    line_item_index,
    COUNT(*) as duplicate_count,
    array_agg(override_category) as categories,
    array_agg(override_account_type) as account_types,
    array_agg(id::text) as override_ids
FROM gl_transaction_overrides
WHERE transaction_id IN (
    SELECT qb_bill_id::text FROM quickbooks_bills 
    WHERE vendor_name LIKE '%MTN%' OR vendor_name LIKE '%High-Technology%'
    UNION
    SELECT qb_expense_id::text FROM quickbooks_expenses 
    WHERE vendor_name LIKE '%MTN%' OR vendor_name LIKE '%High-Technology%'
)
GROUP BY transaction_source, transaction_id, line_item_index
HAVING COUNT(*) > 1;

-- ============================================================================
-- STEP 4: DELETE existing overrides (if you want to replace them)
-- ============================================================================

-- UNCOMMENT BELOW TO DELETE EXISTING MTN OVERRIDES
/*
DELETE FROM gl_transaction_overrides
WHERE id IN (
    SELECT o.id
    FROM gl_transaction_overrides o
    LEFT JOIN quickbooks_bills b ON o.transaction_id = b.qb_bill_id::text
    LEFT JOIN quickbooks_expenses e ON o.transaction_id = e.qb_expense_id::text
    WHERE o.transaction_source = 'bill' AND (b.vendor_name LIKE '%MTN%' OR b.vendor_name LIKE '%High-Technology%')
       OR o.transaction_source = 'expense' AND (e.vendor_name LIKE '%MTN%' OR e.vendor_name LIKE '%High-Technology%')
);
*/

-- ============================================================================
-- INSTRUCTIONS:
-- ============================================================================
-- 1. Run STEP 1 to find all MTN transactions
-- 2. Run STEP 2 to see existing overrides
-- 3. Run STEP 3 to check for duplicates
-- 4. If you want to replace existing overrides, uncomment and run STEP 4
-- 5. Then you can create new overrides
-- ============================================================================

