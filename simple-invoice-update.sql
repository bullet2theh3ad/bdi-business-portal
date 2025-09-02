-- SIMPLE & SAFE Invoice Number Update
-- Updates: Re1.MT-EY20250710A → MT-EY20250710A

-- Step 1: Check current invoice exists
SELECT 
    'CURRENT INVOICE' as status,
    id,
    invoice_number,
    customer_name,
    total_value
FROM invoices 
WHERE invoice_number = 'Re1.MT-EY20250710A';

-- Step 2: Check new invoice number doesn't exist
SELECT 
    'CONFLICT CHECK' as status,
    CASE 
        WHEN COUNT(*) = 0 THEN 'SAFE - No conflicts'
        ELSE 'CONFLICT - New number already exists!'
    END as result
FROM invoices 
WHERE invoice_number = 'MT-EY20250710A';

-- Step 3: Perform the update in a transaction
BEGIN;

UPDATE invoices 
SET 
    invoice_number = 'MT-EY20250710A',
    updated_at = NOW()
WHERE invoice_number = 'Re1.MT-EY20250710A';

-- Step 4: Verify the update
SELECT 
    'UPDATED INVOICE' as status,
    id,
    invoice_number,
    customer_name,
    total_value,
    updated_at
FROM invoices 
WHERE invoice_number = 'MT-EY20250710A';

-- Step 5: Verify old invoice is gone
SELECT 
    'CLEANUP CHECK' as status,
    COUNT(*) as old_invoice_count
FROM invoices 
WHERE invoice_number = 'Re1.MT-EY20250710A';

-- Step 6: Commit the changes
COMMIT;

-- Final confirmation
SELECT 
    'SUCCESS!' as status,
    'Invoice number updated successfully' as message,
    invoice_number,
    customer_name
FROM invoices 
WHERE invoice_number = 'MT-EY20250710A';
