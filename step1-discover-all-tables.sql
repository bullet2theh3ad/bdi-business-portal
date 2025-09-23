-- STEP 1: DISCOVER ALL TABLES FIRST
-- Just get the basic table information, no assumptions about columns

-- Get all tables in the database
SELECT 
    table_name,
    table_type,
    table_schema
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
    AND table_name NOT LIKE '_prisma%'
    AND table_name NOT LIKE 'drizzle_%'
ORDER BY table_name;

-- Get row counts for all tables (this will work regardless of column structure)
SELECT 
    schemaname,
    tablename,
    n_tup_ins as estimated_rows,
    n_tup_upd as estimated_updates,
    n_tup_del as estimated_deletes,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables 
ORDER BY n_tup_ins DESC NULLS LAST;

-- Get table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_readable,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_stat_user_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check what storage buckets exist
SELECT 
    name as bucket_name,
    id as bucket_id,
    created_at,
    updated_at,
    public as is_public
FROM storage.buckets
ORDER BY created_at;


