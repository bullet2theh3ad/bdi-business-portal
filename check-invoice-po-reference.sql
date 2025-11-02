-- Check if deleted invoices had po_reference field
SELECT 
    invoice_number,
    po_reference,
    notes,
    created_at
FROM invoices
WHERE invoice_number LIKE '%P100118073%'
ORDER BY created_at DESC;

-- Check if there are ANY invoices with po_reference set
SELECT COUNT(*) as total_invoices,
       COUNT(po_reference) as invoices_with_po_reference
FROM invoices;

