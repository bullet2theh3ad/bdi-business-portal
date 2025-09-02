-- Quick check of current customer names in invoices
-- See what's actually in the database

-- Check all invoices and their customer names
SELECT 
    invoice_number,
    customer_name,
    total_value,
    created_at,
    updated_at
FROM invoices 
ORDER BY updated_at DESC;

-- Check which customer names we have
SELECT 
    customer_name,
    COUNT(*) as invoice_count,
    SUM(total_value::numeric) as total_value
FROM invoices 
GROUP BY customer_name
ORDER BY customer_name;

-- Check invoice line items for TC1 specifically
SELECT 
    'TC1 INVOICE LINE ITEMS' as info,
    i.invoice_number,
    i.customer_name,
    ili.sku_code,
    ili.sku_name,
    ili.quantity
FROM invoice_line_items ili
JOIN invoices i ON ili.invoice_id = i.id
WHERE i.customer_name = 'TC1'
ORDER BY i.invoice_number;

-- Check what SKU IDs TC1 should have access to
SELECT 
    'TC1 SKU ACCESS' as info,
    ili.sku_id,
    ps.sku,
    ps.name
FROM invoice_line_items ili
JOIN invoices i ON ili.invoice_id = i.id
JOIN product_skus ps ON ili.sku_id = ps.id
WHERE i.customer_name = 'TC1';
