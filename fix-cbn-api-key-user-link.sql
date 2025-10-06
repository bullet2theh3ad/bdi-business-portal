-- Fix CBN API key by linking it to a CBN admin user
-- This will resolve the "Internal server error" when CBN uploads files

-- First, let's see the current CBN API key status
SELECT 
  ak.id,
  ak.key_name,
  ak.user_auth_id,
  ak.organization_uuid,
  org.code
FROM api_keys ak
JOIN organizations org ON ak.organization_uuid = org.id
WHERE ak.key_hash = encode(sha256('bdi_cbn_529b84058b3db4bb38f37b1e4b92c1027dfc5b160edc214e85da74ee10b6df14'::bytea), 'hex');

-- Link CBN API key to Monica Luan (CBN admin)
-- Monica Luan: auth_id = '06125261-9404-4f23-8aac-6e4baf3996fa'
UPDATE api_keys 
SET user_auth_id = '06125261-9404-4f23-8aac-6e4baf3996fa'
WHERE key_hash = encode(sha256('bdi_cbn_529b84058b3db4bb38f37b1e4b92c1027dfc5b160edc214e85da74ee10b6df14'::bytea), 'hex');

-- Verify the link was created successfully
SELECT 
  ak.id as api_key_id,
  ak.key_name,
  ak.user_auth_id,
  u.name as linked_user_name,
  u.email as linked_user_email,
  u.role as linked_user_role,
  org.code as org_code
FROM api_keys ak
LEFT JOIN users u ON ak.user_auth_id = u.auth_id
JOIN organizations org ON ak.organization_uuid = org.id
WHERE ak.key_hash = encode(sha256('bdi_cbn_529b84058b3db4bb38f37b1e4b92c1027dfc5b160edc214e85da74ee10b6df14'::bytea), 'hex');
