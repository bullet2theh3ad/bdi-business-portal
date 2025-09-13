-- Fix Alec's email confirmation issue in Supabase auth

-- OPTION 1: Manually confirm his email in Supabase auth (if you have access)
UPDATE auth.users 
SET 
  email_confirmed_at = NOW(),
  updated_at = NOW()
WHERE email = 'alec.deangelo@ol-usa.com';

-- OPTION 2: If above fails due to permissions, check what we can do
SELECT 
  'ALEC AUTH STATUS' as check,
  email,
  email_confirmed_at,
  last_sign_in_at,
  created_at,
  id as auth_id
FROM auth.users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- Verify the fix worked
SELECT 
  'AFTER EMAIL CONFIRMATION FIX' as status,
  u.email,
  u.name,
  u.role,
  u.is_active,
  au.email_confirmed_at,
  CASE 
    WHEN au.email_confirmed_at IS NOT NULL THEN '✅ EMAIL CONFIRMED - CAN LOGIN'
    ELSE '❌ STILL NOT CONFIRMED'
  END as email_status
FROM users u
LEFT JOIN auth.users au ON u.auth_id = au.id
WHERE u.email = 'alec.deangelo@ol-usa.com';

-- Show all users who might have similar email confirmation issues
SELECT 
  'USERS WITH EMAIL ISSUES' as check,
  u.email,
  u.name,
  u.role,
  au.email_confirmed_at,
  CASE 
    WHEN au.email_confirmed_at IS NULL THEN '❌ NEEDS EMAIL CONFIRMATION'
    ELSE '✅ EMAIL CONFIRMED'
  END as status
FROM users u
LEFT JOIN auth.users au ON u.auth_id = au.id
WHERE u.is_active = true
AND (au.email_confirmed_at IS NULL OR au.id IS NULL)
ORDER BY u.email;
