-- Check which QuickBooks tables exist
SELECT 
    tablename,
    schemaname
FROM pg_tables
WHERE tablename LIKE 'quickbooks%'
ORDER BY tablename;

-- Check which QuickBooks indexes exist
SELECT 
    indexname,
    tablename
FROM pg_indexes
WHERE indexname LIKE '%qb_%'
ORDER BY indexname;

