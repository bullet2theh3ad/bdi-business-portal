-- Simple SQL to list all tables in the database
-- Just the basics - table names and row counts

SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
    AND table_name NOT LIKE '_prisma%'
    AND table_name NOT LIKE 'drizzle_%'
ORDER BY table_name;

