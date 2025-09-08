-- Check if steve@spnnet.com still exists and delete completely

-- 1. Check current state
SELECT 
    'CHECKING STEVE USER' as action,
    id,
    auth_id,
    email,
    name,
    role,
    is_active,
    password_hash,
    created_at
FROM users 
WHERE email = 'steve@spnnet.com';

-- 2. Check organization memberships
SELECT 
    'CHECKING STEVE MEMBERSHIPS' as action,
    om.user_auth_id,
    o.code as org_code,
    o.name as org_name,
    om.role as org_role
FROM organization_members om
JOIN organizations o ON om.organization_uuid = o.id
JOIN users u ON om.user_auth_id = u.auth_id
WHERE u.email = 'steve@spnnet.com';

-- 3. Force delete organization memberships
DELETE FROM organization_members 
WHERE user_auth_id IN (
    SELECT auth_id FROM users WHERE email = 'steve@spnnet.com'
);

-- 4. Force delete user
DELETE FROM users 
WHERE email = 'steve@spnnet.com';

-- 5. Clean up any legacy invitations
DELETE FROM organization_invitations 
WHERE invited_email = 'steve@spnnet.com';

-- 6. Final verification - should return no results
SELECT 
    'FINAL CHECK - Should be empty' as result,
    email,
    name
FROM users 
WHERE email = 'steve@spnnet.com';
