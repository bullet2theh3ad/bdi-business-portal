-- Check Supabase auth sync for all users - find missing auth records

-- Check Alec specifically in both tables
SELECT 'ALEC AUTH CHECK' as check_type;

-- Our users table
SELECT 
  'OUR USERS TABLE' as source,
  email,
  name,
  role,
  is_active,
  auth_id,
  created_at
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- Supabase auth.users table (if accessible)
SELECT 
  'SUPABASE AUTH TABLE' as source,
  email,
  email_confirmed_at,
  last_sign_in_at,
  created_at,
  updated_at,
  id as supabase_auth_id
FROM auth.users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- Check ALL users - find auth sync issues
SELECT 'ALL USERS AUTH SYNC CHECK' as check_type;

-- Find users in our table but NOT in auth.users
SELECT 
  'MISSING FROM AUTH' as issue_type,
  u.email,
  u.name,
  u.role,
  u.is_active,
  u.auth_id,
  'User exists in our DB but not in Supabase auth' as problem
FROM users u
LEFT JOIN auth.users au ON u.auth_id = au.id
WHERE u.is_active = true 
AND au.id IS NULL
ORDER BY u.created_at;

-- Find users in auth.users but NOT in our users table
SELECT 
  'MISSING FROM USERS' as issue_type,
  au.email,
  au.created_at as auth_created,
  au.email_confirmed_at,
  'User exists in Supabase auth but not in our users table' as problem
FROM auth.users au
LEFT JOIN users u ON au.id = u.auth_id
WHERE u.auth_id IS NULL
ORDER BY au.created_at;

-- Show auth_id mismatches
SELECT 
  'AUTH_ID MISMATCH' as issue_type,
  u.email,
  u.auth_id as our_auth_id,
  au.id as supabase_auth_id,
  'auth_id mismatch between tables' as problem
FROM users u
JOIN auth.users au ON u.email = au.email
WHERE u.auth_id != au.id;

-- Summary of all sync issues
SELECT 
  'SYNC SUMMARY' as summary,
  COUNT(*) as total_users_in_our_table
FROM users;

SELECT 
  'SYNC SUMMARY' as summary,
  COUNT(*) as total_users_in_auth_table
FROM auth.users;

-- Show active users who should be able to log in
SELECT 
  'SHOULD BE ABLE TO LOGIN' as status,
  u.email,
  u.name,
  u.role,
  u.is_active,
  au.email_confirmed_at,
  CASE 
    WHEN au.email_confirmed_at IS NOT NULL THEN '✅ EMAIL CONFIRMED'
    WHEN au.email_confirmed_at IS NULL THEN '❌ EMAIL NOT CONFIRMED'
    ELSE '⚠️ NOT IN AUTH TABLE'
  END as email_status
FROM users u
LEFT JOIN auth.users au ON u.auth_id = au.id
WHERE u.is_active = true
AND u.role IN ('admin', 'super_admin')
ORDER BY u.email;
