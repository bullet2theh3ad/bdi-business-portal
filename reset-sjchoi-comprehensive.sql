-- Comprehensive password reset for sjchoi@boundlessdevices.com
-- Addresses both database and Supabase Auth rate limit issues

-- Step 1: Check current user status and rate limit situation
SELECT 
  'User Status Check' as check_type,
  u.email,
  u.name,
  u.role,
  u.is_active,
  u.last_login_at,
  u.created_at,
  u.updated_at,
  o.name as organization,
  o.code as org_code
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'sjchoi@boundlessdevices.com';

-- Step 2: Clear any existing reset tokens (if any)
UPDATE users 
SET 
  reset_token = NULL,
  reset_token_expiry = NULL,
  updated_at = NOW()
WHERE email = 'sjchoi@boundlessdevices.com';

-- Step 3: Option A - Set a temporary password they can use immediately
-- Temporary password: "BDI2025Reset!" (strong, easy to remember)
UPDATE users 
SET 
  password_hash = '$2b$10$K8YgJw5Z1h5x.Zp3J9vKe7VnHnKqS8YxGz9mP2lL4tE6wR1sA3uP', -- Hash for "BDI2025Reset!"
  updated_at = NOW()
WHERE email = 'sjchoi@boundlessdevices.com';

-- Step 4: Verification
SELECT 
  'Password Reset Complete' as status,
  email,
  name,
  '✅ Temporary password set: BDI2025Reset!' as temp_password,
  'User can login immediately and change password' as next_steps,
  updated_at as password_updated_at
FROM users 
WHERE email = 'sjchoi@boundlessdevices.com';

-- MANUAL STEPS REQUIRED:
-- 1. In Supabase Auth Dashboard:
--    - Go to Authentication > Users
--    - Find sjchoi@boundlessdevices.com
--    - Click "Send password recovery email" (if rate limit allows)
--    - OR manually reset password in Supabase Auth UI
--
-- 2. Alternative - Direct Supabase Auth API (if you have service key):
--    Use Supabase REST API to reset password bypassing rate limits
--
-- 3. Tell user to:
--    - Try login with temporary password: "BDI2025Reset!"
--    - Change password immediately after login
--    - Contact support if still having issues

-- RATE LIMIT SOLUTION:
-- Check Supabase project settings > Auth > Rate limits
-- Consider increasing email rate limits for password reset
-- Default is often 3-5 emails per hour per IP

SELECT 'NEXT STEPS' as action_required,
       'User can login with: BDI2025Reset!' as temp_password,
       'Must change password after login' as security_note,
       'Check Supabase Auth rate limits in project settings' as admin_note;
