-- Fix Alec's auth_id mismatch while handling foreign key constraints

-- STEP 1: Check current organization memberships for Alec
SELECT 
  'CURRENT ORGANIZATION MEMBERSHIPS' as check,
  om.user_auth_id,
  om.organization_id,
  om.membership_role,
  om.joined_at,
  o.name as organization_name,
  o.code as organization_code
FROM organization_members om
LEFT JOIN organizations o ON om.organization_id = o.id
WHERE om.user_auth_id = 'b697864c-9845-4c95-b792-e4e24112f326';

-- STEP 2: Update organization_members table with correct auth_id FIRST
UPDATE organization_members 
SET 
  user_auth_id = '2890729a-5d8b-49ce-b87c-cd726efb801a',
  updated_at = NOW()
WHERE user_auth_id = 'b697864c-9845-4c95-b792-e4e24112f326';

-- STEP 3: Now update users table (foreign key constraint should be satisfied)
UPDATE users 
SET 
  auth_id = '2890729a-5d8b-49ce-b87c-cd726efb801a',
  updated_at = NOW()
WHERE email = 'alec.deangelo@ol-usa.com';

-- STEP 4: Verify both tables are now in sync
SELECT 
  'USERS TABLE AFTER FIX' as table_check,
  email,
  name,
  role,
  is_active,
  auth_id,
  updated_at
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

SELECT 
  'ORGANIZATION_MEMBERS AFTER FIX' as table_check,
  om.user_auth_id,
  om.membership_role,
  o.name as organization_name,
  o.code as organization_code,
  om.updated_at
FROM organization_members om
LEFT JOIN organizations o ON om.organization_id = o.id
WHERE om.user_auth_id = '2890729a-5d8b-49ce-b87c-cd726efb801a';

-- STEP 5: Final login verification
SELECT 
  'FINAL LOGIN CHECK' as status,
  u.email,
  u.name,
  u.role,
  u.is_active,
  u.auth_id,
  au.email_confirmed_at,
  CASE 
    WHEN u.is_active = true 
     AND u.auth_id = au.id 
     AND au.email_confirmed_at IS NOT NULL 
    THEN '✅ READY TO LOGIN'
    ELSE '❌ STILL BLOCKED'
  END as login_ready
FROM users u
LEFT JOIN auth.users au ON u.auth_id = au.id
WHERE u.email = 'alec.deangelo@ol-usa.com';

-- STEP 6: Check if there are other users with similar constraint issues
SELECT 
  'OTHER USERS WITH CONSTRAINT ISSUES' as check,
  u.email,
  u.auth_id as users_auth_id,
  au.id as supabase_auth_id,
  CASE 
    WHEN u.auth_id != au.id THEN '⚠️ MISMATCH - NEEDS FIX'
    WHEN au.id IS NULL THEN '❌ NOT IN AUTH TABLE'
    ELSE '✅ SYNCED'
  END as sync_status
FROM users u
LEFT JOIN auth.users au ON u.email = au.email
WHERE u.is_active = true
AND u.role IN ('admin', 'super_admin')
ORDER BY sync_status, u.email;
