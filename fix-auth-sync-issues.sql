-- Fix common Supabase auth sync issues for users who can't log in

-- STEP 1: Fix Alec's account specifically
UPDATE users 
SET 
  is_active = true,
  deleted_at = NULL,
  reset_token = NULL,
  reset_token_expiry = NULL,
  role = 'admin',
  updated_at = NOW()
WHERE email = 'alec.deangelo@ol-usa.com';

-- STEP 2: If Alec's auth_id is wrong, we need to find his correct Supabase auth ID
-- First, let's see if there's a Supabase auth user with his email
SELECT 
  'FIND CORRECT AUTH_ID' as step,
  email,
  id as correct_auth_id,
  email_confirmed_at,
  created_at
FROM auth.users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- STEP 3: Update auth_id if we find a mismatch
-- (Run this ONLY if the above query shows a different ID than what's in users table)
/*
UPDATE users 
SET auth_id = 'CORRECT_AUTH_ID_FROM_ABOVE_QUERY'
WHERE email = 'alec.deangelo@ol-usa.com';
*/

-- STEP 4: Fix all users with similar auth sync issues
-- Update any users who have is_active = false but should be active
UPDATE users 
SET 
  is_active = true,
  deleted_at = NULL,
  updated_at = NOW()
WHERE email IN (
  'alec.deangelo@ol-usa.com',
  'scistulli@premierss.com',
  'dzand@boundlessdevices.com'
) AND is_active = false;

-- STEP 5: Clear any problematic reset tokens for all admin users
UPDATE users 
SET 
  reset_token = NULL,
  reset_token_expiry = NULL,
  updated_at = NOW()
WHERE role IN ('admin', 'super_admin')
AND (reset_token IS NOT NULL OR reset_token_expiry IS NOT NULL);

-- STEP 6: Verify all admin users can log in
SELECT 
  'ADMIN LOGIN VERIFICATION' as check,
  u.email,
  u.name,
  u.role,
  u.is_active,
  u.deleted_at,
  u.auth_id,
  au.email_confirmed_at,
  CASE 
    WHEN u.is_active = true 
     AND u.deleted_at IS NULL 
     AND u.auth_id IS NOT NULL 
     AND au.email_confirmed_at IS NOT NULL 
    THEN '✅ READY TO LOGIN'
    WHEN au.id IS NULL THEN '❌ NOT IN AUTH TABLE'
    WHEN au.email_confirmed_at IS NULL THEN '❌ EMAIL NOT CONFIRMED'
    WHEN u.is_active = false THEN '❌ ACCOUNT INACTIVE'
    ELSE '⚠️ OTHER ISSUE'
  END as login_status
FROM users u
LEFT JOIN auth.users au ON u.auth_id = au.id
WHERE u.role IN ('admin', 'super_admin')
ORDER BY u.email;

-- STEP 7: If users are missing from auth.users entirely, they need to register again
-- Show users who exist in our table but not in Supabase auth
SELECT 
  'NEED TO RE-REGISTER' as action_needed,
  u.email,
  u.name,
  u.role,
  'User needs to go through signup process again' as instruction
FROM users u
LEFT JOIN auth.users au ON u.auth_id = au.id
WHERE u.is_active = true
AND u.role IN ('admin', 'super_admin')
AND au.id IS NULL;
