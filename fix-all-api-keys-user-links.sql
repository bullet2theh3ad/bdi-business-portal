-- Fix all API keys to be properly linked to organization admin users
-- This resolves "Internal server error" for all API uploads

-- Step 1: Check current API keys that are NOT linked to users
SELECT 
  ak.id,
  ak.key_name,
  ak.key_prefix,
  ak.user_auth_id,
  org.code as org_code,
  org.name as org_name,
  CASE 
    WHEN ak.user_auth_id IS NULL THEN '❌ NO USER LINKED'
    ELSE '✅ USER LINKED'
  END as status
FROM api_keys ak
JOIN organizations org ON ak.organization_uuid = org.id
ORDER BY org.code;

-- Step 2: Fix CBN API key specifically (link to Monica Luan - admin)
UPDATE api_keys 
SET user_auth_id = '06125261-9404-4f23-8aac-6e4baf3996fa'  -- Monica Luan
WHERE key_hash = encode(sha256('bdi_cbn_529b84058b3db4bb38f37b1e4b92c1027dfc5b160edc214e85da74ee10b6df14'::bytea), 'hex');

-- Step 3: Fix ALL unlinked API keys by auto-linking to first admin of each organization
UPDATE api_keys 
SET user_auth_id = (
  SELECT u.auth_id
  FROM organization_members om
  JOIN users u ON om.user_auth_id = u.auth_id
  WHERE om.organization_uuid = api_keys.organization_uuid
    AND om.role = 'admin'
    AND u.is_active = true
  ORDER BY u.created_at ASC
  LIMIT 1
)
WHERE user_auth_id IS NULL;

-- Step 4: Verify all API keys are now properly linked
SELECT 
  ak.id,
  ak.key_name,
  ak.key_prefix,
  ak.user_auth_id,
  u.name as linked_user_name,
  u.email as linked_user_email,
  u.role as linked_user_role,
  org.code as org_code,
  org.name as org_name,
  CASE 
    WHEN ak.user_auth_id IS NULL THEN '❌ STILL NO USER'
    WHEN u.is_active = false THEN '⚠️ USER INACTIVE'
    ELSE '✅ PROPERLY LINKED'
  END as status
FROM api_keys ak
JOIN organizations org ON ak.organization_uuid = org.id
LEFT JOIN users u ON ak.user_auth_id = u.auth_id
ORDER BY org.code;

-- Step 5: Show summary of fixes applied
SELECT 
  COUNT(*) as total_api_keys,
  COUNT(CASE WHEN ak.user_auth_id IS NOT NULL THEN 1 END) as linked_keys,
  COUNT(CASE WHEN ak.user_auth_id IS NULL THEN 1 END) as unlinked_keys
FROM api_keys ak;
