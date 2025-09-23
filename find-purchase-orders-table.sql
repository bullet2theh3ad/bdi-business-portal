-- Find the actual purchase orders table name
-- Check all tables that might contain purchase order data

-- 1. List all tables with 'purchase' or 'order' in the name
SELECT table_schema, table_name, table_type
FROM information_schema.tables 
WHERE table_name ILIKE '%purchase%' 
   OR table_name ILIKE '%order%'
ORDER BY table_schema, table_name;

-- 2. List all tables in the public schema
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 3. Check if there's a schema prefix needed
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename ILIKE '%purchase%' 
   OR tablename ILIKE '%order%';

-- 4. Alternative: Look for any table with columns that match purchase order structure
SELECT t.table_name, c.column_name
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE c.column_name IN ('purchase_order_number', 'supplier_name', 'purchase_order_date')
  AND t.table_schema = 'public'
GROUP BY t.table_name, c.column_name
ORDER BY t.table_name;
