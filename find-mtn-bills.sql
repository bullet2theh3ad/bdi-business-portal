-- ============================================================================
-- FIND MTN BILLS that are showing as Unclassified
-- ============================================================================

-- Find all MTN bills
SELECT 
    qb_bill_id,
    bill_date,
    vendor_name,
    total_amount,
    line_items
FROM quickbooks_bills
WHERE vendor_name LIKE '%MTN%'
ORDER BY bill_date DESC;

-- Check if these bills have overrides
SELECT 
    b.qb_bill_id,
    b.bill_date,
    b.vendor_name,
    b.total_amount,
    o.override_category,
    o.override_account_type,
    CASE 
        WHEN o.id IS NULL THEN '❌ NO OVERRIDE'
        ELSE '✅ HAS OVERRIDE'
    END as override_status
FROM quickbooks_bills b
LEFT JOIN gl_transaction_overrides o 
    ON o.transaction_source = 'bill' 
    AND o.transaction_id = b.qb_bill_id::text
    AND o.line_item_index IS NULL
WHERE b.vendor_name LIKE '%MTN%'
ORDER BY b.bill_date DESC;

-- Find the specific expense with MTN (not full name)
SELECT 
    qb_expense_id,
    expense_date,
    vendor_name,
    total_amount,
    line_items
FROM quickbooks_expenses
WHERE vendor_name = 'MTN'
ORDER BY expense_date DESC;

-- Check if MTN expense has override
SELECT 
    e.qb_expense_id,
    e.expense_date,
    e.vendor_name,
    e.total_amount,
    o.override_category,
    o.override_account_type,
    CASE 
        WHEN o.id IS NULL THEN '❌ NO OVERRIDE'
        ELSE '✅ HAS OVERRIDE'
    END as override_status
FROM quickbooks_expenses e
LEFT JOIN gl_transaction_overrides o 
    ON o.transaction_source = 'expense' 
    AND o.transaction_id = e.qb_expense_id::text
    AND o.line_item_index IS NULL
WHERE e.vendor_name = 'MTN'
ORDER BY e.expense_date DESC;

