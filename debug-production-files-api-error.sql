-- Debug production files API error
-- Check if there are missing columns or schema issues

-- Check if production_files table exists and has all required columns
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'production_files' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if api_keys table exists and has the GPN key
SELECT 
    id,
    key_name,
    key_prefix,
    organization_uuid,
    permissions,
    is_active,
    created_at
FROM api_keys 
WHERE key_prefix LIKE 'bdi_gpn_%'
ORDER BY created_at DESC;

-- Check if organizations table has the GPN organization
SELECT 
    id,
    code,
    name,
    type,
    is_active
FROM organizations 
WHERE code = 'GPN';

-- Check if there are any production files at all
SELECT COUNT(*) as total_production_files FROM production_files;

-- Check if organization_connections table exists (needed for API access)
SELECT COUNT(*) as total_connections FROM organization_connections;
