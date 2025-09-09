-- Promote a business partner to Super Admin role
-- 
-- STEP 1: First run check-bdi-users-for-promotion.sql to see all BDI users
-- STEP 2: Replace 'partner@example.com' below with the actual email address
-- STEP 3: Run this script

-- Check current user status before promotion
SELECT 
    'BEFORE PROMOTION' as status,
    id,
    auth_id,
    email,
    name,
    role,
    is_active,
    created_at
FROM users 
WHERE email = 'partner@example.com'; -- REPLACE WITH ACTUAL EMAIL

-- Promote user to super_admin role
UPDATE users 
SET 
    role = 'super_admin',
    updated_at = NOW()
WHERE email = 'partner@example.com' -- REPLACE WITH ACTUAL EMAIL
  AND is_active = true;

-- Verify the promotion was successful
SELECT 
    'AFTER PROMOTION' as status,
    id,
    auth_id,
    email,
    name,
    role,
    is_active,
    updated_at
FROM users 
WHERE email = 'partner@example.com'; -- REPLACE WITH ACTUAL EMAIL

-- Confirm they're in BDI organization with proper access
SELECT 
    'BDI ORGANIZATION MEMBERSHIP' as status,
    u.email,
    u.name,
    u.role as system_role,
    om.role as org_role,
    o.code as org_code,
    o.name as org_name,
    om.created_at as member_since
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'partner@example.com' -- REPLACE WITH ACTUAL EMAIL
  AND o.code = 'BDI';

-- Show all current Super Admins for confirmation
SELECT 
    'ALL SUPER ADMINS' as status,
    email,
    name,
    role,
    is_active,
    created_at
FROM users 
WHERE role = 'super_admin' 
  AND is_active = true
ORDER BY created_at;
