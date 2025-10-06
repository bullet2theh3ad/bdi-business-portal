-- Check CBN API key and user linkage
-- This will show if CBN's API key is properly linked to a user

-- Check CBN API key with correct column name
SELECT 
  ak.id,
  ak.key_name,
  ak.organization_uuid,
  ak.user_auth_id,
  ak.permissions,
  ak.is_active,
  ak.expires_at,
  org.code as org_code,
  org.name as org_name
FROM api_keys ak
JOIN organizations org ON ak.organization_uuid = org.id
WHERE ak.key_hash = encode(sha256('bdi_cbn_529b84058b3db4bb38f37b1e4b92c1027dfc5b160edc214e85da74ee10b6df14'::bytea), 'hex');

-- Check if CBN API key has a linked user
SELECT 
  ak.id as api_key_id,
  ak.key_name,
  ak.user_auth_id,
  u.id as user_id,
  u.auth_id as user_auth_id,
  u.name as user_name,
  u.email as user_email,
  u.role as user_role,
  u.is_active as user_is_active
FROM api_keys ak
LEFT JOIN users u ON ak.user_auth_id = u.auth_id
WHERE ak.key_hash = encode(sha256('bdi_cbn_529b84058b3db4bb38f37b1e4b92c1027dfc5b160edc214e85da74ee10b6df14'::bytea), 'hex');

-- Check all CBN users to see who could be linked to the API key
SELECT 
  u.id,
  u.auth_id,
  u.name,
  u.email,
  u.role,
  u.is_active,
  om.organization_uuid,
  org.code as org_code
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations org ON om.organization_uuid = org.id
WHERE org.code = 'CBN';
