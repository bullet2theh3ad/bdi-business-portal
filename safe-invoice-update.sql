-- SAFE Invoice Number Update Script
-- Updates: Re1.MT-EY20250710A → MT-EY20250710A
-- Includes full verification and rollback safety

-- ========================================
-- STEP 1: PRE-UPDATE VERIFICATION
-- ========================================

-- Check current invoice details
SELECT 
    '=== CURRENT INVOICE DETAILS ===' as info,
    id,
    invoice_number,
    customer_name,
    total_value,
    created_at,
    updated_at
FROM invoices 
WHERE invoice_number = 'Re1.MT-EY20250710A';

-- Check related line items
SELECT 
    '=== RELATED LINE ITEMS ===' as info,
    ili.id,
    ili.sku_code,
    ili.sku_name,
    ili.quantity,
    ili.unit_cost,
    ili.line_total
FROM invoice_line_items ili
JOIN invoices i ON ili.invoice_id = i.id
WHERE i.invoice_number = 'Re1.MT-EY20250710A';

-- Check related documents
SELECT 
    '=== RELATED DOCUMENTS ===' as info,
    id.id,
    id.file_name,
    id.file_size,
    id.storage_path
FROM invoice_documents id
JOIN invoices i ON id.invoice_id = i.id
WHERE i.invoice_number = 'Re1.MT-EY20250710A';

-- Verify new invoice number doesn't exist
SELECT 
    '=== CHECKING FOR CONFLICTS ===' as info,
    CASE 
        WHEN COUNT(*) = 0 THEN 'SAFE TO PROCEED - No conflicts found'
        ELSE 'CONFLICT DETECTED - Invoice MT-EY20250710A already exists!'
    END as conflict_status
FROM invoices 
WHERE invoice_number = 'MT-EY20250710A';

-- ========================================
-- STEP 2: PERFORM THE UPDATE (TRANSACTION)
-- ========================================

-- Start transaction for safety
BEGIN;

-- Update the invoice number
UPDATE invoices 
SET 
    invoice_number = 'MT-EY20250710A',
    updated_at = NOW()
WHERE invoice_number = 'Re1.MT-EY20250710A';

-- Verify the update worked
SELECT 
    '=== POST-UPDATE VERIFICATION ===' as info,
    CASE 
        WHEN COUNT(*) = 1 THEN 'SUCCESS - Invoice updated correctly'
        ELSE 'ERROR - Update failed or multiple records affected'
    END as update_status
FROM invoices 
WHERE invoice_number = 'MT-EY20250710A';

-- Check that old invoice number is gone
SELECT 
    '=== OLD INVOICE CHECK ===' as info,
    CASE 
        WHEN COUNT(*) = 0 THEN 'SUCCESS - Old invoice number removed'
        ELSE 'ERROR - Old invoice still exists'
    END as cleanup_status
FROM invoices 
WHERE invoice_number = 'Re1.MT-EY20250710A';

-- Final verification - show updated invoice
SELECT 
    '=== FINAL UPDATED INVOICE ===' as info,
    id,
    invoice_number,
    customer_name,
    total_value,
    updated_at
FROM invoices 
WHERE invoice_number = 'MT-EY20250710A';

-- Show that line items are still properly linked
SELECT 
    '=== LINKED LINE ITEMS VERIFICATION ===' as info,
    COUNT(*) as line_item_count,
    SUM(ili.quantity) as total_quantity,
    SUM(ili.line_total::numeric) as total_value
FROM invoice_line_items ili
JOIN invoices i ON ili.invoice_id = i.id
WHERE i.invoice_number = 'MT-EY20250710A';

-- ========================================
-- STEP 3: COMMIT OR ROLLBACK
-- ========================================

-- If everything looks correct above, COMMIT the transaction:
COMMIT;

-- If there are any issues, ROLLBACK instead:
-- ROLLBACK;

-- ========================================
-- STEP 4: FINAL VERIFICATION
-- ========================================

-- Confirm the change is permanent
SELECT 
    '=== FINAL CONFIRMATION ===' as info,
    invoice_number,
    customer_name,
    'Invoice number successfully updated!' as status
FROM invoices 
WHERE invoice_number = 'MT-EY20250710A';
