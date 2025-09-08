-- Investigate OLM vs OL-USA discrepancy
-- Check where the name/code mismatch originated

-- 1. Check the OLM organization details completely
SELECT 
    'OLM Organization Complete Details' as check_type,
    id,
    name,
    code,
    legal_name,
    type,
    is_active,
    created_at,
    updated_at
FROM organizations 
WHERE code = 'OLM' OR id = '870fc2eb-27e7-42b5-a476-815fdff2fa7c';

-- 2. Check if there's any organization with name containing "OL-USA"
SELECT 
    'Organizations with OL-USA Name' as check_type,
    id,
    name,
    code,
    legal_name,
    type,
    is_active,
    created_at
FROM organizations 
WHERE name ILIKE '%OL-USA%' 
   OR legal_name ILIKE '%OL-USA%'
   OR name ILIKE '%OL%USA%';

-- 3. Check Alec's user record to see what organization info was used during creation
SELECT 
    'Alec User Record Analysis' as check_type,
    id,
    auth_id,
    name,
    email,
    role,
    title,
    department,
    password_hash,
    is_active,
    reset_token,
    reset_token_expiry,
    created_at,
    updated_at
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- 4. Check if Alec has organization membership with OLM
SELECT 
    'Alec OLM Membership Check' as check_type,
    om.id,
    om.user_auth_id,
    om.organization_uuid,
    om.role,
    om.joined_at,
    o.name as org_name,
    o.code as org_code,
    u.email as user_email,
    u.name as user_name
FROM organization_members om
JOIN organizations o ON om.organization_uuid = o.id
JOIN users u ON om.user_auth_id = u.auth_id
WHERE o.code = 'OLM' 
  AND u.email = 'alec.deangelo@ol-usa.com';

-- 5. Check for any organizations that might be related to "OL" or logistics
SELECT 
    'All OL/Logistics Organizations' as check_type,
    id,
    name,
    code,
    type,
    is_active,
    created_at
FROM organizations 
WHERE code ILIKE '%OL%' 
   OR name ILIKE '%OL%'
   OR type = 'shipping_logistics'
ORDER BY created_at DESC;

-- 6. Decode Alec's invitation token to see what organization info was sent
-- (This would need to be done in the application, but let's check what we can from the DB)
SELECT 
    'Token Analysis Needed' as check_type,
    'Check invitation token: eyJvcmdhbml6YXRpb25JZCI6Ijg3MGZjMmViLTI3ZTctNDJiNS1hNDc2LTgxNWZkZmYyZmE3YyIsIm9yZ2FuaXphdGlvbk5hbWUiOiJPTC1VU0EiLCJhZG1pbkVtYWlsIjoiYWxlYy5kZWFuZ2Vsb0BvbC11c2EuY29tIiwicm9sZSI6ImFkbWluIiwidGltZXN0YW1wIjoxNzU3MjQzMTQ2Mjk5fQ' as token_info,
    'Organization ID in token: 870fc2eb-27e7-42b5-a476-815fdff2fa7c' as org_id_from_token,
    'Organization Name in token: OL-USA' as org_name_from_token;
