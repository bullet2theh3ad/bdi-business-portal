-- Fix Alec's auth_id mismatch between our users table and Supabase auth

-- STEP 1: Show current mismatch
SELECT 
  'CURRENT AUTH_ID MISMATCH' as issue,
  email,
  name,
  auth_id as our_auth_id,
  'b697864c-9845-4c95-b792-e4e24112f326' as current_wrong_id,
  '2890729a-5d8b-49ce-b87c-cd726efb801a' as correct_supabase_id
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- STEP 2: Update our users table with correct Supabase auth_id
UPDATE users 
SET 
  auth_id = '2890729a-5d8b-49ce-b87c-cd726efb801a',
  updated_at = NOW()
WHERE email = 'alec.deangelo@ol-usa.com';

-- STEP 3: Verify the fix
SELECT 
  'AFTER AUTH_ID FIX' as status,
  email,
  name,
  role,
  is_active,
  auth_id,
  updated_at,
  CASE 
    WHEN auth_id = '2890729a-5d8b-49ce-b87c-cd726efb801a' 
    THEN '✅ AUTH_ID FIXED - SHOULD BE ABLE TO LOGIN'
    ELSE '❌ AUTH_ID STILL WRONG'
  END as fix_status
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- STEP 4: Check for other users with similar auth_id mismatches
SELECT 
  'CHECKING OTHER USERS FOR MISMATCHES' as check_type,
  u.email,
  u.name,
  u.auth_id as our_auth_id,
  au.id as supabase_auth_id,
  CASE 
    WHEN u.auth_id = au.id THEN '✅ MATCH'
    WHEN au.id IS NULL THEN '❌ NOT IN AUTH TABLE'
    ELSE '⚠️ MISMATCH'
  END as sync_status
FROM users u
LEFT JOIN auth.users au ON u.email = au.email
WHERE u.is_active = true
AND u.role IN ('admin', 'super_admin')
ORDER BY sync_status, u.email;

-- STEP 5: Fix any other auth_id mismatches found
-- (This will update auth_id for users where email matches but auth_id doesn't)
UPDATE users 
SET 
  auth_id = (
    SELECT au.id 
    FROM auth.users au 
    WHERE au.email = users.email
  ),
  updated_at = NOW()
WHERE email IN (
  SELECT u.email
  FROM users u
  JOIN auth.users au ON u.email = au.email
  WHERE u.auth_id != au.id
  AND u.is_active = true
);

-- Final verification - all admin users should now be able to log in
SELECT 
  'FINAL LOGIN STATUS' as final_check,
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
    THEN '✅ CAN LOGIN'
    ELSE '❌ STILL BLOCKED'
  END as login_status
FROM users u
LEFT JOIN auth.users au ON u.auth_id = au.id
WHERE u.role IN ('admin', 'super_admin')
ORDER BY login_status, u.email;
