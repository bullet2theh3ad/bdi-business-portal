-- Fix steve@spnnet.com auth ID mismatch causing access issues
-- Current Supabase auth ID: 89868a09-c648-4ee7-8c23-9eba6dce7c00
-- Current Database auth ID: bf311240-0d74-429e-8292-c82b3bc06c26

-- Update user's auth_id to match current Supabase session
UPDATE users 
SET auth_id = '89868a09-c648-4ee7-8c23-9eba6dce7c00'
WHERE email = 'steve@spnnet.com';

-- Update organization membership to use new auth_id
UPDATE organization_members 
SET user_auth_id = '89868a09-c648-4ee7-8c23-9eba6dce7c00'
WHERE user_auth_id = 'bf311240-0d74-429e-8292-c82b3bc06c26';

-- Verify the fix
SELECT 
    'STEVE SPNNET AUTH FIX VERIFICATION' as status,
    id,
    auth_id,
    email,
    name,
    role,
    supplier_code,
    is_active
FROM users 
WHERE email = 'steve@spnnet.com';

-- Verify organization membership
SELECT 
    'STEVE SPNNET MEMBERSHIP VERIFICATION' as status,
    u.email,
    u.auth_id as user_auth_id,
    om.user_auth_id as membership_auth_id,
    om.role as org_role,
    o.code as org_code
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'steve@spnnet.com';
