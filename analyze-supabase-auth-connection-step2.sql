-- Step 2: Analyze Supabase Auth Connection and Password Sync
-- Understanding how database passwords relate to Supabase Auth

-- 1. Check auth.users table structure (Supabase Auth side)
-- Note: This may require service role access
SELECT 
  'Supabase Auth Users Structure' as analysis_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'auth' 
  AND table_name = 'users'
  AND column_name IN ('id', 'email', 'encrypted_password', 'email_confirmed_at', 'recovery_sent_at', 'created_at', 'updated_at')
ORDER BY ordinal_position;

-- 2. Check if our database users sync with Supabase Auth users
SELECT 
  'Database vs Auth Sync Analysis' as analysis_type,
  COUNT(*) as total_db_users,
  COUNT(CASE WHEN auth_id IS NOT NULL THEN 1 END) as users_with_auth_id,
  COUNT(CASE WHEN password_hash IS NOT NULL THEN 1 END) as users_with_db_password
FROM users;

-- 3. Check specific users auth_id mapping
SELECT 
  'Auth ID Mapping' as analysis_type,
  u.email,
  u.auth_id as db_auth_id,
  u.created_at as db_created,
  CASE 
    WHEN u.auth_id IS NOT NULL THEN '✅ Has Auth ID'
    ELSE '❌ Missing Auth ID'
  END as auth_id_status
FROM users u
WHERE u.email IN ('sjchoi@boundlessdevices.com', 'scistulli@boundlessdevices.com', 'dzand@boundlessdevices.com')
ORDER BY u.email;

-- 4. Check if we can see Supabase Auth users (if accessible)
-- This might not work depending on RLS policies
SELECT 
  'Supabase Auth Users Check' as analysis_type,
  id as auth_user_id,
  email,
  email_confirmed_at,
  CASE 
    WHEN encrypted_password IS NOT NULL THEN '✅ Has Supabase Password'
    ELSE '❌ No Supabase Password'
  END as supabase_password_status,
  recovery_sent_at,
  created_at as auth_created,
  updated_at as auth_updated
FROM auth.users
WHERE email IN ('sjchoi@boundlessdevices.com', 'scistulli@boundlessdevices.com', 'dzand@boundlessdevices.com')
ORDER BY email;

-- 5. Check for any auth-related triggers or functions
SELECT 
  'Auth Triggers Analysis' as analysis_type,
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'users'
   OR action_statement ILIKE '%auth%'
   OR action_statement ILIKE '%password%';

-- ANALYSIS GOALS:
-- 1. Understand dual password storage (database vs Supabase Auth)
-- 2. Check if auth_id properly links database users to Supabase Auth users
-- 3. Identify why Supabase Auth is still sending recovery emails
-- 4. Determine if passwords need to be updated in both places
-- 5. Find any automatic sync mechanisms between database and Supabase Auth
