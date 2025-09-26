-- Step 1: Analyze Password Architecture in BDI Portal
-- Understanding where passwords are stored and how they interact

-- 1. Check database password storage structure
SELECT 
  'Database Password Storage Analysis' as analysis_type,
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name IN ('password_hash', 'reset_token', 'reset_token_expiry', 'auth_id')
ORDER BY ordinal_position;

-- 2. Check current users and their password hash status
SELECT 
  'Current Users Password Status' as analysis_type,
  email,
  name,
  role,
  CASE 
    WHEN password_hash IS NOT NULL THEN '✅ Has Password Hash'
    ELSE '❌ No Password Hash'
  END as db_password_status,
  CASE 
    WHEN reset_token IS NOT NULL THEN '🔄 Has Reset Token'
    ELSE '✅ No Reset Token'
  END as reset_token_status,
  CASE 
    WHEN reset_token_expiry IS NOT NULL AND reset_token_expiry > NOW() THEN '⏰ Token Valid'
    WHEN reset_token_expiry IS NOT NULL AND reset_token_expiry <= NOW() THEN '⏰ Token Expired'
    ELSE '✅ No Token'
  END as token_expiry_status,
  is_active,
  last_login_at,
  created_at
FROM users
WHERE email IN ('sjchoi@boundlessdevices.com', 'scistulli@boundlessdevices.com', 'dzand@boundlessdevices.com')
ORDER BY email;

-- 3. Check if there are any password-related triggers or functions
SELECT 
  'Database Password Functions' as analysis_type,
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_definition ILIKE '%password%'
   OR routine_definition ILIKE '%auth%'
   OR routine_name ILIKE '%password%'
   OR routine_name ILIKE '%auth%';

-- 4. Check for any password-related policies or constraints
SELECT 
  'Password Policies' as analysis_type,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
  AND (pg_get_constraintdef(oid) ILIKE '%password%' 
       OR pg_get_constraintdef(oid) ILIKE '%auth%');

-- 5. Sample password hash analysis (check format and patterns)
SELECT 
  'Password Hash Analysis' as analysis_type,
  email,
  LEFT(password_hash, 10) as hash_prefix,
  LENGTH(password_hash) as hash_length,
  CASE 
    WHEN password_hash LIKE '$2b$%' THEN '✅ bcrypt format'
    WHEN password_hash LIKE '$2a$%' THEN '✅ bcrypt format (legacy)'
    WHEN password_hash LIKE '$argon2%' THEN '🔧 Argon2 format'
    ELSE '❓ Unknown format'
  END as hash_format,
  updated_at as last_password_update
FROM users
WHERE password_hash IS NOT NULL
ORDER BY updated_at DESC
LIMIT 5;

-- SUMMARY QUESTIONS TO ANSWER:
-- 1. Are passwords stored in both database AND Supabase Auth?
-- 2. What format are database password hashes? (bcrypt, argon2, etc.)
-- 3. Do we have proper reset token infrastructure in database?
-- 4. Are there any constraints or triggers affecting passwords?
-- 5. When were passwords last updated for key users?
