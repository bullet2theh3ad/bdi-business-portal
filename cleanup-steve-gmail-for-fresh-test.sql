-- Cleanup steve.cistulli@gmail.com for fresh invitation testing

-- STEP 1: Check what exists currently
SELECT 
  'CURRENT STATE CHECK' as check_type,
  'users table' as location,
  email,
  name,
  auth_id,
  role,
  password_hash,
  is_active,
  created_at
FROM users 
WHERE email = 'steve.cistulli@gmail.com';

-- Check organization memberships
SELECT 
  'CURRENT STATE CHECK' as check_type,
  'organization_members table' as location,
  om.user_auth_id,
  om.organization_uuid,
  om.role,
  o.name as organization_name,
  o.code as organization_code
FROM organization_members om
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE om.user_auth_id IN (
  SELECT auth_id FROM users WHERE email = 'steve.cistulli@gmail.com'
);

-- Check if there are any organization_invitations records (from our failed attempt)
SELECT 
  'CURRENT STATE CHECK' as check_type,
  'organization_invitations table' as location,
  invited_email,
  status,
  created_at,
  expires_at
FROM organization_invitations 
WHERE invited_email = 'steve.cistulli@gmail.com';

-- Check Supabase auth table
SELECT 
  'CURRENT STATE CHECK' as check_type,
  'auth.users table' as location,
  email,
  id as supabase_auth_id,
  email_confirmed_at,
  created_at
FROM auth.users 
WHERE email = 'steve.cistulli@gmail.com';

-- STEP 2: CLEANUP - Delete from organization_members first (foreign key dependency)
DELETE FROM organization_members 
WHERE user_auth_id IN (
  SELECT auth_id FROM users WHERE email = 'steve.cistulli@gmail.com'
);

-- STEP 3: Delete from users table
DELETE FROM users 
WHERE email = 'steve.cistulli@gmail.com';

-- STEP 4: Delete any organization_invitations records (from our parallel system attempt)
DELETE FROM organization_invitations 
WHERE invited_email = 'steve.cistulli@gmail.com';

-- STEP 5: OPTIONAL - Delete from Supabase auth (if exists)
-- NOTE: This might need to be done manually in Supabase dashboard if needed
-- DELETE FROM auth.users WHERE email = 'steve.cistulli@gmail.com';

-- STEP 6: Verify cleanup
SELECT 
  'CLEANUP VERIFICATION' as check_type,
  'users table' as location,
  COUNT(*) as remaining_records
FROM users 
WHERE email = 'steve.cistulli@gmail.com';

SELECT 
  'CLEANUP VERIFICATION' as check_type,
  'organization_members table' as location,
  COUNT(*) as remaining_records
FROM organization_members om
WHERE om.user_auth_id IN (
  SELECT auth_id FROM users WHERE email = 'steve.cistulli@gmail.com'
);

SELECT 
  'CLEANUP VERIFICATION' as check_type,
  'organization_invitations table' as location,
  COUNT(*) as remaining_records
FROM organization_invitations 
WHERE invited_email = 'steve.cistulli@gmail.com';

-- All counts should be 0 after cleanup

-- READY FOR FRESH TEST:
-- After running this cleanup, you can send a fresh invitation to steve.cistulli@gmail.com
-- and test the fixed system from scratch!
