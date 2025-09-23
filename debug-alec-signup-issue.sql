-- Debug Alec's Sign-up Issue - Check what's missing for OL-USA setup
-- Based on the sign-up action logic, check each step that could fail

-- 1. Check if OL-USA organization exists (this is likely missing)
SELECT 
    'OL-USA Organization Status' as check_type,
    id,
    name,
    code,
    type,
    is_active,
    legal_name,
    created_at
FROM organizations 
WHERE code = 'OL-USA' 
   OR name ILIKE '%OL-USA%' 
   OR name ILIKE '%OL%' 
   OR legal_name ILIKE '%OL%USA%';

-- 2. Verify Alec's user record details
SELECT 
    'Alec User Details' as check_type,
    id,
    auth_id,
    name,
    email,
    role,
    password_hash,
    is_active,
    title,
    department,
    created_at,
    updated_at
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- 3. Check if Alec has any organization memberships
SELECT 
    'Alec Organization Memberships' as check_type,
    om.id as membership_id,
    om.user_auth_id,
    om.organization_uuid,
    om.role as membership_role,
    om.joined_at,
    o.name as org_name,
    o.code as org_code,
    o.is_active as org_active
FROM organization_members om
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE om.user_auth_id = (
    SELECT auth_id FROM users WHERE email = 'alec.deangelo@ol-usa.com'
);

-- 4. Check what organizations DO exist (to see if OL-USA was created with different name)
SELECT 
    'All Active Organizations' as check_type,
    id,
    name,
    code,
    type,
    is_active,
    created_at
FROM organizations 
WHERE is_active = true
ORDER BY created_at DESC;

-- 5. Check for any recent organization creation attempts
SELECT 
    'Recent Organizations' as check_type,
    id,
    name,
    code,
    type,
    is_active,
    created_at
FROM organizations 
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- 6. Check if there's a Supabase auth user for Alec
-- (This would help identify if the Supabase user creation step failed)
SELECT 
    'Alec Auth ID Check' as check_type,
    auth_id,
    email,
    name,
    password_hash,
    is_active
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';








