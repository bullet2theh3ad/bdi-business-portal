-- Cleanup orphaned users without organization memberships
-- These users violate the business rule that every user must belong to an organization

-- First, let's verify what we're about to delete
SELECT 
    'ORPHANED USERS TO DELETE' as action,
    u.email,
    u.name,
    u.role,
    u.is_active,
    'No org membership' as issue
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
WHERE om.user_auth_id IS NULL;

-- Delete the orphaned users
-- 1. steve.cistulli@gmail.com (Oldman Tester - no org)
DELETE FROM users 
WHERE email = 'steve.cistulli@gmail.com' 
  AND name = 'Oldman Tester';

-- 2. sales3@mtncn.com (Enya Zhou - inactive + no org)  
DELETE FROM users 
WHERE email = 'sales3@mtncn.com' 
  AND name = 'Enya Zhou';

-- 3. Reset Alec's account for fresh invitation testing
-- First remove from organization_members
DELETE FROM organization_members 
WHERE user_auth_id = (
    SELECT auth_id FROM users WHERE email = 'alec.deangelo@ol-usa.com'
);

-- Then remove the user record
DELETE FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- Verify cleanup - should return no orphaned users
SELECT 
    'VERIFICATION - Should be empty' as check_type,
    u.email,
    u.name,
    u.role,
    u.is_active
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
WHERE om.user_auth_id IS NULL;

-- Show final clean user list
SELECT 
    'FINAL CLEAN USER LIST' as status,
    u.email,
    u.name,
    u.role,
    u.is_active,
    o.code as org_code,
    o.name as org_name,
    om.role as org_role
FROM users u
INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
INNER JOIN organizations o ON om.organization_uuid = o.id
ORDER BY o.code, u.email;
