-- Manual cleanup for steve@cistulli.com user
-- Run these commands in your Supabase SQL Editor

-- 1. First, check what organization memberships this user has
SELECT om.*, o.name as org_name, o.code as org_code
FROM organization_members om 
LEFT JOIN organizations o ON om.organization_uuid = o.id 
WHERE om.user_auth_id IN (
  SELECT auth_id FROM users WHERE email = 'steve@cistulli.com'
);

-- 2. Delete any organization memberships for this user
DELETE FROM organization_members 
WHERE user_auth_id IN (
  SELECT auth_id FROM users WHERE email = 'steve@cistulli.com'
);

-- 3. Delete the user record
DELETE FROM users WHERE email = 'steve@cistulli.com';

-- 4. Verify the user is completely gone
SELECT * FROM users WHERE email = 'steve@cistulli.com';
-- Should return: no rows

-- 5. Verify no orphaned memberships
SELECT * FROM organization_members 
WHERE user_auth_id NOT IN (SELECT auth_id FROM users);
-- Should return: no rows (no orphaned memberships)
