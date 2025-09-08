-- Debug Alec's Invitation and OL-USA Organization Setup
-- Check if organization, user, and membership records exist properly

-- 1. Check if OL-USA organization exists
SELECT 
    'OL-USA Organization Check' as check_type,
    id,
    name,
    code,
    type,
    is_active,
    created_at
FROM organizations 
WHERE code = 'OL-USA' OR name ILIKE '%OL-USA%' OR name ILIKE '%OL%USA%';

-- 2. Check for Alec's user record
SELECT 
    'Alec User Record Check' as check_type,
    id,
    auth_id,
    name,
    email,
    role,
    password_hash,
    is_active,
    created_at,
    reset_token,
    reset_token_expiry
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- 3. Check organization memberships for Alec
SELECT 
    'Alec Organization Membership Check' as check_type,
    om.id,
    om.user_auth_id,
    om.organization_uuid,
    om.role,
    om.joined_at,
    o.name as organization_name,
    o.code as organization_code,
    u.email as user_email,
    u.name as user_name,
    u.is_active as user_active
FROM organization_members om
LEFT JOIN organizations o ON om.organization_uuid = o.id
LEFT JOIN users u ON om.user_auth_id = u.auth_id
WHERE u.email = 'alec.deangelo@ol-usa.com';

-- 4. Check for any pending invitations
SELECT 
    'Pending Invitations Check' as check_type,
    id,
    email,
    organization_uuid,
    role,
    status,
    token,
    expires_at,
    accepted_at
FROM invitations 
WHERE email = 'alec.deangelo@ol-usa.com';

-- 5. Check all organizations to see what exists
SELECT 
    'All Organizations' as check_type,
    id,
    name,
    code,
    type,
    is_active,
    created_at
FROM organizations 
ORDER BY created_at DESC
LIMIT 10;

-- 6. Check for any users with similar emails (in case of typos)
SELECT 
    'Similar Email Check' as check_type,
    id,
    name,
    email,
    role,
    is_active,
    password_hash
FROM users 
WHERE email ILIKE '%alec%' OR email ILIKE '%deangelo%' OR email ILIKE '%ol-usa%';
