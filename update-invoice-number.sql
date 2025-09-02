-- Update Invoice Number: Re1.MT-EY20250710A → MT-EY20250710A
-- This script safely updates the invoice number and ensures data integrity

-- First, let's check what we're working with
SELECT 
    id,
    invoice_number,
    customer_name,
    total_value,
    created_at
FROM invoices 
WHERE invoice_number = 'Re1.MT-EY20250710A';

-- Check for any dependencies (line items, documents)
SELECT 
    'Line Items' as table_name,
    COUNT(*) as count
FROM invoice_line_items ili
JOIN invoices i ON ili.invoice_id = i.id
WHERE i.invoice_number = 'Re1.MT-EY20250710A'

UNION ALL

SELECT 
    'Documents' as table_name,
    COUNT(*) as count
FROM invoice_documents id
JOIN invoices i ON id.invoice_id = i.id
WHERE i.invoice_number = 'Re1.MT-EY20250710A';

-- Check if the new invoice number already exists
SELECT 
    id,
    invoice_number,
    customer_name
FROM invoices 
WHERE invoice_number = 'MT-EY20250710A';

-- If the above query returns no results, proceed with the update
-- UPDATE the invoice number
BEGIN;

UPDATE invoices 
SET 
    invoice_number = 'MT-EY20250710A',
    updated_at = NOW()
WHERE invoice_number = 'Re1.MT-EY20250710A';

-- Verify the update
SELECT 
    id,
    invoice_number,
    customer_name,
    total_value,
    updated_at
FROM invoices 
WHERE invoice_number = 'MT-EY20250710A';

-- Check that no orphaned records exist
SELECT 
    'Updated Invoice' as status,
    invoice_number,
    customer_name
FROM invoices 
WHERE invoice_number = 'MT-EY20250710A'

UNION ALL

SELECT 
    'Old Invoice (should be empty)' as status,
    invoice_number,
    customer_name
FROM invoices 
WHERE invoice_number = 'Re1.MT-EY20250710A';

-- If everything looks good, commit the transaction
-- COMMIT;

-- If something is wrong, rollback
-- ROLLBACK;
