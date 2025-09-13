-- Ensure Alec DeAngelo can log in - fix all potential blockers

-- First, check current status
SELECT 
  'BEFORE FIXES' as status,
  email,
  name,
  role,
  is_active,
  deleted_at,
  reset_token_expiry,
  last_login_at,
  created_at
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- Fix 1: Ensure account is active and not deleted
UPDATE users 
SET 
  is_active = true,
  deleted_at = NULL,
  updated_at = NOW()
WHERE email = 'alec.deangelo@ol-usa.com';

-- Fix 2: Clear any expired reset tokens that might block login
UPDATE users 
SET 
  reset_token = NULL,
  reset_token_expiry = NULL,
  updated_at = NOW()
WHERE email = 'alec.deangelo@ol-usa.com';

-- Fix 3: Ensure proper admin role
UPDATE users 
SET 
  role = 'admin',
  updated_at = NOW()
WHERE email = 'alec.deangelo@ol-usa.com';

-- Check after fixes
SELECT 
  'AFTER FIXES' as status,
  email,
  name,
  role,
  is_active,
  deleted_at,
  reset_token,
  reset_token_expiry,
  last_login_at,
  updated_at,
  CASE 
    WHEN is_active = true AND deleted_at IS NULL AND role = 'admin' 
    THEN '✅ READY TO LOGIN'
    ELSE '❌ STILL BLOCKED'
  END as login_ready
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- Check if there are any auth.users issues (Supabase auth table)
-- Note: This might not work if you don't have access to auth schema
-- But it's worth trying
SELECT 
  'AUTH TABLE CHECK' as check_type,
  email,
  email_confirmed_at,
  last_sign_in_at,
  created_at as auth_created_at,
  updated_at as auth_updated_at
FROM auth.users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- Alternative: Check if email exists in auth.users at all
-- If this fails, the issue might be that the auth user doesn't exist
SELECT COUNT(*) as auth_user_exists
FROM auth.users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- Show final verification
SELECT 
  'FINAL VERIFICATION' as check,
  u.email,
  u.name,
  u.role,
  u.is_active,
  u.auth_id,
  CASE 
    WHEN u.is_active = true AND u.deleted_at IS NULL AND u.role IN ('admin', 'super_admin')
    THEN '✅ ALL CHECKS PASSED - SHOULD BE ABLE TO LOGIN'
    ELSE '❌ ISSUE FOUND - CHECK INDIVIDUAL FIELDS'
  END as final_status
FROM users u
WHERE u.email = 'alec.deangelo@ol-usa.com';
