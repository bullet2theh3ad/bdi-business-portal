-- Template for deleting existing users when "A user with this email already exists" error occurs
-- Replace {EMAIL} with the actual email address causing the conflict

-- 1. First, check what user exists with this email
SELECT 
    'USER TO DELETE' as action,
    id,
    auth_id,
    email,
    name,
    role,
    is_active,
    password_hash,
    created_at
FROM users 
WHERE email = '{EMAIL}';

-- 2. Check their organization memberships
SELECT 
    'USER MEMBERSHIPS' as action,
    om.user_auth_id,
    o.code as org_code,
    o.name as org_name,
    om.role as org_role
FROM organization_members om
JOIN organizations o ON om.organization_uuid = o.id
JOIN users u ON om.user_auth_id = u.auth_id
WHERE u.email = '{EMAIL}';

-- 3. Delete organization memberships first (foreign key constraint)
DELETE FROM organization_members 
WHERE user_auth_id IN (
    SELECT auth_id FROM users WHERE email = '{EMAIL}'
);

-- 4. Delete the user record
DELETE FROM users 
WHERE email = '{EMAIL}';

-- 5. Clean up any legacy invitation tokens
DELETE FROM organization_invitations 
WHERE invited_email = '{EMAIL}';

-- 6. Verification - should return 0
SELECT 
    'VERIFICATION' as result,
    COUNT(*) as remaining_users
FROM users 
WHERE email = '{EMAIL}';

-- 7. Success message
SELECT 'User {EMAIL} has been completely removed and is now available for invitation' as status;
