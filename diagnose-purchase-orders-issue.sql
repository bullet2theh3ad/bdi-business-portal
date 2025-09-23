-- Comprehensive diagnosis of purchase orders table issue
-- Run this to figure out what's wrong

-- 1. Show current database and schema
SELECT current_database(), current_schema();

-- 2. List ALL tables to see what exists
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. Check if table exists with different case
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND LOWER(table_name) LIKE '%purchase%'
ORDER BY table_name;

-- 4. Look for any table with purchase order columns
SELECT DISTINCT table_name
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND column_name IN ('purchase_order_number', 'supplier_name', 'purchase_order_date')
ORDER BY table_name;

-- 5. If you see the table, try to describe its structure
-- (Uncomment the next line if you find the table exists)
-- \d purchase_orders

-- 6. Check if we're connected to the right database
SELECT 
    current_database() as connected_database,
    current_user as connected_user,
    inet_server_addr() as server_address,
    inet_server_port() as server_port;
