-- Add file type permissions to API keys
-- This allows controlling which file types each API key can access

-- Add allowed_file_types column to api_keys table
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS allowed_file_types TEXT[] DEFAULT ARRAY['PRODUCTION_FILE', 'ROYALTY_ZONE_1', 'ROYALTY_ZONE_2', 'ROYALTY_ZONE_3', 'ROYALTY_ZONE_4', 'ROYALTY_ZONE_5', 'MAC_ADDRESS_LIST', 'SERIAL_NUMBER_LIST', 'PRODUCTION_REPORT', 'TEST_RESULTS', 'CALIBRATION_DATA', 'FIRMWARE_VERSION', 'QUALITY_CONTROL', 'PACKAGING_LIST', 'GENERIC'];

-- Update existing GPN API key to have specific file type permissions
UPDATE api_keys 
SET allowed_file_types = ARRAY['PRODUCTION_FILE', 'ROYALTY_ZONE_4', 'TEST_RESULTS', 'QUALITY_CONTROL']
WHERE key_name = 'GPN-Production-Files';

-- Verify the update
SELECT 
    key_name,
    key_prefix,
    allowed_file_types,
    permissions
FROM api_keys 
WHERE key_prefix LIKE 'bdi_gpn_%';
