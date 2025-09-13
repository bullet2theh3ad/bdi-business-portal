-- MANUAL COMPLETE DELETION: steve.cistulli@gmail.com
-- This will clean up EVERYTHING so we can test the fixed invitation system

-- STEP 1: Delete from organization_members (foreign key dependency)
DELETE FROM organization_members 
WHERE user_auth_id IN (
  SELECT auth_id FROM users WHERE email = 'steve.cistulli@gmail.com'
);

-- STEP 2: Delete from users table
DELETE FROM users 
WHERE email = 'steve.cistulli@gmail.com';

-- STEP 3: Delete from organization_invitations (our parallel system attempts)
DELETE FROM organization_invitations 
WHERE invited_email = 'steve.cistulli@gmail.com';

-- STEP 4: Delete from Supabase auth.users (the blocking issue)
DELETE FROM auth.users 
WHERE email = 'steve.cistulli@gmail.com';

-- STEP 5: Verify complete cleanup
SELECT 
  'FINAL VERIFICATION' as check_type,
  'users table' as table_name,
  COUNT(*) as remaining_records
FROM users 
WHERE email = 'steve.cistulli@gmail.com'

UNION ALL

SELECT 
  'FINAL VERIFICATION' as check_type,
  'organization_members table' as table_name,
  COUNT(*) as remaining_records
FROM organization_members om
WHERE om.user_auth_id IN (
  SELECT auth_id FROM users WHERE email = 'steve.cistulli@gmail.com'
)

UNION ALL

SELECT 
  'FINAL VERIFICATION' as check_type,
  'organization_invitations table' as table_name,
  COUNT(*) as remaining_records
FROM organization_invitations 
WHERE invited_email = 'steve.cistulli@gmail.com'

UNION ALL

SELECT 
  'FINAL VERIFICATION' as check_type,
  'auth.users table' as table_name,
  COUNT(*) as remaining_records
FROM auth.users 
WHERE email = 'steve.cistulli@gmail.com';

-- ALL COUNTS SHOULD BE 0 AFTER THIS CLEANUP
-- THEN TEST FRESH INVITATION!
