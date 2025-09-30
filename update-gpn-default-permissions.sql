-- Update GPN API key to use PRODUCTION_FILE as default
-- Since PRODUCTION_FILE includes device data, this is all GPN needs by default

UPDATE api_keys 
SET allowed_file_types = ARRAY['PRODUCTION_FILE']
WHERE key_name = 'GPN-Production-Files';

-- Verify the update
SELECT 
    key_name,
    key_prefix,
    allowed_file_types,
    permissions
FROM api_keys 
WHERE key_prefix LIKE 'bdi_gpn_%';
