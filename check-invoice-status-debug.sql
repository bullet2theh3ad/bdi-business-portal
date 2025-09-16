-- Check the actual status of the invoice in the database
-- This will reveal if the status is being saved correctly

SELECT 
    'INVOICE STATUS CHECK' as debug_type,
    id,
    invoice_number,
    customer_name,
    total_value,
    status,
    terms,
    incoterms,
    incoterms_location,
    invoice_date,
    ship_date,
    customer_address,
    ship_to_address,
    bank_name,
    bank_account_number,
    bank_routing_number,
    bank_swift_code,
    updated_at
FROM invoices 
WHERE id = '8a0e2257-a0af-4bb0-884c-30c5e98d8afb'
ORDER BY updated_at DESC;

-- Also check what statuses are allowed by the constraint
SELECT 
    'ALLOWED STATUSES CHECK' as debug_type,
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name = 'invoices_status_check';

-- Check if there are any other invoices with submitted_to_finance status
SELECT 
    'OTHER SUBMITTED INVOICES' as debug_type,
    COUNT(*) as count_submitted_to_finance
FROM invoices 
WHERE status = 'submitted_to_finance';
