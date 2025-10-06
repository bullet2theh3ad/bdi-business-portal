-- Debug CBN API upload issue
-- Check if CBN organization and API key are properly configured

-- 1. Check CBN organization exists and is properly configured
SELECT 
  id,
  name,
  code,
  type,
  legal_name,
  business_address,
  created_at
FROM organizations 
WHERE code = 'CBN';

-- 2. Check CBN API key exists and has correct permissions
SELECT 
  ak.id,
  ak.key_name,
  ak.organization_id,
  ak.permissions,
  ak.is_active,
  ak.expires_at,
  ak.rate_limit_per_hour,
  ak.usage_count,
  org.code as org_code,
  org.name as org_name
FROM api_keys ak
JOIN organizations org ON ak.organization_id = org.id
WHERE ak.key_hash = encode(sha256('bdi_cbn_529b84058b3db4bb38f37b1e4b92c1027dfc5b160edc214e85da74ee10b6df14'::bytea), 'hex');

-- 3. Check if CBN has any existing production files
SELECT 
  pf.id,
  pf.file_name,
  pf.file_type,
  pf.organization_id,
  pf.created_at,
  org.code as org_code
FROM production_files pf
JOIN organizations org ON pf.organization_id = org.id
WHERE org.code = 'CBN'
ORDER BY pf.created_at DESC
LIMIT 5;

-- 4. Check production_files table structure for required fields
\d production_files;

-- 5. Check if there are any constraints that might be failing
SELECT 
  conname,
  contype,
  confrelid::regclass,
  pg_get_constraintdef(oid)
FROM pg_constraint 
WHERE conrelid = 'production_files'::regclass;

-- 6. Test what would happen if we tried to insert a production file for CBN
-- (This is a dry run - we'll see what fields might be missing)
SELECT 
  org.id as organization_id,
  org.code,
  org.name,
  'Would insert production file here' as test_status
FROM organizations org
WHERE org.code = 'CBN';
