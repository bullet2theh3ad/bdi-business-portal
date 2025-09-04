-- Find all tables and columns that reference organization codes
-- This will help us understand the cascade impact of changing TC1 → MTN

-- Check for organization_id foreign key references
SELECT 
    kcu.table_name,
    kcu.column_name,
    ccu.table_name as referenced_table,
    ccu.column_name as referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'organizations';

-- Check for any columns that might store organization codes as strings
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name ILIKE '%org%code%' 
    OR column_name ILIKE '%customer%' 
    OR column_name ILIKE '%supplier%'
    OR column_name = 'code'
ORDER BY table_name, column_name;

-- Check specific tables that likely reference organizations
SELECT 'invoices' as table_name, customer_name, COUNT(*) as count
FROM invoices 
WHERE customer_name IN ('BDI', 'TC1', 'OLM')
GROUP BY customer_name
UNION ALL
SELECT 'users' as table_name, supplier_code, COUNT(*) as count
FROM users 
WHERE supplier_code IN ('BDI', 'TC1', 'OLM')
GROUP BY supplier_code
ORDER BY table_name, customer_name;
