-- Simple fix for Alec's auth_id mismatch - avoid unknown columns

-- STEP 1: Check what columns actually exist in organization_members
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organization_members' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- STEP 2: Show current organization_members records for old auth_id (without unknown columns)
SELECT *
FROM organization_members 
WHERE user_auth_id = 'b697864c-9845-4c95-b792-e4e24112f326';

-- STEP 3: Update organization_members with correct auth_id (simple update)
UPDATE organization_members 
SET 
  user_auth_id = '2890729a-5d8b-49ce-b87c-cd726efb801a'
WHERE user_auth_id = 'b697864c-9845-4c95-b792-e4e24112f326';

-- STEP 4: Update users table with correct auth_id
UPDATE users 
SET 
  auth_id = '2890729a-5d8b-49ce-b87c-cd726efb801a',
  updated_at = NOW()
WHERE email = 'alec.deangelo@ol-usa.com';

-- STEP 5: Verify the fix worked
SELECT 
  'ALEC AFTER AUTH_ID FIX' as status,
  email,
  name,
  role,
  is_active,
  auth_id,
  CASE 
    WHEN auth_id = '2890729a-5d8b-49ce-b87c-cd726efb801a' 
    THEN '✅ AUTH_ID FIXED'
    ELSE '❌ STILL WRONG'
  END as fix_status
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- STEP 6: Check organization_members was updated
SELECT 
  'ORGANIZATION_MEMBERS UPDATED' as status,
  user_auth_id,
  organization_uuid
FROM organization_members 
WHERE user_auth_id = '2890729a-5d8b-49ce-b87c-cd726efb801a';

-- STEP 7: Final login test - check if Alec can now authenticate
SELECT 
  'FINAL LOGIN TEST' as test,
  u.email,
  u.role,
  u.is_active,
  u.auth_id,
  au.email_confirmed_at,
  CASE 
    WHEN u.auth_id = au.id AND au.email_confirmed_at IS NOT NULL 
    THEN '✅ CAN LOGIN NOW'
    ELSE '❌ STILL BLOCKED'
  END as login_status
FROM users u
LEFT JOIN auth.users au ON u.auth_id = au.id
WHERE u.email = 'alec.deangelo@ol-usa.com';
