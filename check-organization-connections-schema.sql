-- Check the actual organization_connections table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'organization_connections' 
ORDER BY ordinal_position;
