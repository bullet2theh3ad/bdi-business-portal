-- Check specific usage of organization codes across tables
-- This will show us exactly what needs to be updated when changing TC1 → MTN

-- Check invoices table
SELECT 'invoices' as table_name, customer_name, COUNT(*) as count
FROM invoices 
WHERE customer_name IN ('BDI', 'TC1', 'OLM')
GROUP BY customer_name;

-- Check users table
SELECT 'users' as table_name, supplier_code, COUNT(*) as count
FROM users 
WHERE supplier_code IN ('BDI', 'TC1', 'OLM', '')
GROUP BY supplier_code;

-- Check sales_forecasts (might filter by organization)
SELECT 'sales_forecasts' as table_name, 'forecasts_count' as field, COUNT(*) as count
FROM sales_forecasts;

-- Check organization_members table
SELECT 'organization_members' as table_name, organization_uuid, COUNT(*) as count
FROM organization_members
GROUP BY organization_uuid;

-- Show sample data from key tables
SELECT 'SAMPLE_INVOICES' as info, id, customer_name, invoice_number, created_at
FROM invoices 
WHERE customer_name = 'TC1'
LIMIT 3;

SELECT 'SAMPLE_USERS' as info, id, name, email, supplier_code
FROM users 
WHERE supplier_code IN ('TC1', 'BDI', 'OLM')
LIMIT 5;
