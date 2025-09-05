-- Check if api_keys table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'api_keys'
);

-- If it exists, show the table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'api_keys' 
ORDER BY ordinal_position;

-- Check if there are any API keys in the table
SELECT 
    id,
    key_name,
    key_prefix,
    organization_uuid,
    permissions,
    rate_limit_per_hour,
    is_active,
    expires_at,
    created_at
FROM api_keys 
ORDER BY created_at DESC
LIMIT 10;

-- Check specifically for GPN API keys
SELECT 
    ak.id,
    ak.key_name,
    ak.key_prefix,
    ak.permissions,
    ak.is_active,
    o.name as organization_name,
    o.code as organization_code
FROM api_keys ak
LEFT JOIN organizations o ON ak.organization_uuid = o.id
WHERE o.code = 'GPN'
ORDER BY ak.created_at DESC;
