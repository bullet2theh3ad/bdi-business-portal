-- Verify organization deletion - run these in your Supabase SQL Editor
-- Replace 'TC1' with the organization code you want to check

-- 1. Check if organization still exists
SELECT * FROM organizations WHERE code = 'TC1';
-- Should return: no rows

-- 2. Check if any organization members still exist for that org
SELECT om.*, u.email, u.name 
FROM organization_members om 
LEFT JOIN users u ON om.user_auth_id = u.auth_id 
WHERE om.organization_uuid = '8fe67372-4156-4316-9025-3f7d4fbae49f';
-- Should return: no rows

-- 3. Check if pending user still exists
SELECT * FROM users WHERE email = 'steve@cistulli.com' AND password_hash = 'invitation_pending';
-- Should return: no rows

-- 4. Check all external organizations (should be empty now)
SELECT id, name, code, type, is_active, created_at 
FROM organizations 
WHERE type != 'internal';
-- Should return: no rows (or only other external orgs if you have them)

-- 5. Check all pending invitation users
SELECT id, name, email, role, is_active, created_at 
FROM users 
WHERE password_hash = 'invitation_pending' AND is_active = false;
-- Should return: no rows

-- 6. Verify BDI organization is still intact
SELECT id, name, code, type, is_active 
FROM organizations 
WHERE type = 'internal' AND code = 'BDI';
-- Should return: 1 row with BDI organization

-- 7. Check for any orphaned organization memberships
SELECT om.*, o.name as org_name, u.email as user_email
FROM organization_members om 
LEFT JOIN organizations o ON om.organization_uuid = o.id 
LEFT JOIN users u ON om.user_auth_id = u.auth_id 
WHERE o.id IS NULL OR u.auth_id IS NULL;
-- Should return: no rows (no orphaned data)
