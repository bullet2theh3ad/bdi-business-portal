-- ============================================================================
-- BULK CATEGORIZE: HARRY F. LONG, INC. → Inventory, Freight In
-- ============================================================================
-- This script categorizes all HARRY F. LONG, INC. transactions as Inventory, Freight In
-- User ID: 18a29c7a-3778-4ea9-a36b-eefabb93d1a3 (scistulli@boundlessdevices.com)

-- ============================================================================
-- STEP 1: PREVIEW - Check what will be categorized
-- ============================================================================

-- Preview Bills from HARRY F. LONG, INC.
SELECT 
    'bill' as source,
    qb_bill_id as id,
    bill_date as date,
    vendor_name,
    total_amount
FROM quickbooks_bills
WHERE vendor_name = 'HARRY F. LONG, INC.'
ORDER BY bill_date DESC;

-- Preview Expenses from HARRY F. LONG, INC.
SELECT 
    'expense' as source,
    qb_expense_id as id,
    expense_date as date,
    vendor_name,
    total_amount
FROM quickbooks_expenses
WHERE vendor_name = 'HARRY F. LONG, INC.'
ORDER BY expense_date DESC;

-- Summary count
SELECT 
    'SUMMARY' as info,
    COUNT(*) as total_transactions,
    SUM(total_amount) as total_amount_usd
FROM (
    SELECT total_amount FROM quickbooks_bills WHERE vendor_name = 'HARRY F. LONG, INC.'
    UNION ALL
    SELECT total_amount FROM quickbooks_expenses WHERE vendor_name = 'HARRY F. LONG, INC.'
) combined;

-- ============================================================================
-- STEP 2: BULK INSERT - Create overrides for all transactions
-- ============================================================================

-- Insert overrides for Bills
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
    'bill' as transaction_source,
    qb_bill_id::text as transaction_id,
    NULL as line_item_index,
    'inventory' as override_category,
    'Freight In' as override_account_type,
    'Bulk categorized: HARRY F. LONG → Inventory, Freight In' as notes,
    '18a29c7a-3778-4ea9-a36b-eefabb93d1a3' as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM quickbooks_bills
WHERE vendor_name = 'HARRY F. LONG, INC.'
  AND qb_bill_id::text NOT IN (
    SELECT transaction_id 
    FROM gl_transaction_overrides 
    WHERE transaction_source = 'bill'
  );

-- Insert overrides for Expenses
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
    'inventory' as override_category,
    'Freight In' as override_account_type,
    'Bulk categorized: HARRY F. LONG → Inventory, Freight In' as notes,
    '18a29c7a-3778-4ea9-a36b-eefabb93d1a3' as created_by,
    NOW() as created_at,
    NOW() as updated_at
FROM quickbooks_expenses
WHERE vendor_name = 'HARRY F. LONG, INC.'
  AND qb_expense_id::text NOT IN (
    SELECT transaction_id 
    FROM gl_transaction_overrides 
    WHERE transaction_source = 'expense'
  );

-- ============================================================================
-- STEP 3: VERIFY - Check what was inserted/updated
-- ============================================================================

-- Verify overrides were created
SELECT 
    transaction_source,
    transaction_id,
    override_category,
    override_account_type,
    notes,
    updated_at
FROM gl_transaction_overrides
WHERE notes LIKE '%HARRY F. LONG%'
ORDER BY updated_at DESC;

-- Count by source
SELECT 
    transaction_source,
    COUNT(*) as override_count,
    override_category,
    override_account_type
FROM gl_transaction_overrides
WHERE notes LIKE '%HARRY F. LONG%'
GROUP BY transaction_source, override_category, override_account_type
ORDER BY transaction_source;

-- ============================================================================
-- INSTRUCTIONS:
-- ============================================================================
-- 1. Run STEP 1 queries to preview what will be categorized
-- 2. Review the preview to confirm these are the correct transactions
-- 3. Run STEP 2 queries to bulk insert the overrides
-- 4. Run STEP 3 queries to verify the overrides were created
-- 5. Refresh the GL Code Assignment page to see the changes
-- ============================================================================

