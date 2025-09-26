-- Step 3: Analyze Login Flow and Password Verification
-- Understanding how login actually works and which password system is used

-- 1. Check recent login activity and methods
SELECT 
  'Recent Login Analysis' as analysis_type,
  email,
  name,
  role,
  last_login_at,
  CASE 
    WHEN last_login_at > NOW() - INTERVAL '7 days' THEN '🟢 Recent Login'
    WHEN last_login_at > NOW() - INTERVAL '30 days' THEN '🟡 Login This Month'
    WHEN last_login_at IS NOT NULL THEN '🔴 Old Login'
    ELSE '❌ Never Logged In'
  END as login_status,
  created_at,
  updated_at
FROM users
ORDER BY last_login_at DESC NULLS LAST
LIMIT 10;

-- 2. Check for any login-related logs or activity tracking
SELECT 
  'Login Activity Tracking' as analysis_type,
  COUNT(*) as total_activity_logs,
  COUNT(CASE WHEN action ILIKE '%login%' THEN 1 END) as login_actions,
  COUNT(CASE WHEN action ILIKE '%password%' THEN 1 END) as password_actions,
  COUNT(CASE WHEN action ILIKE '%auth%' THEN 1 END) as auth_actions,
  MAX(timestamp) as latest_activity
FROM activity_logs
WHERE action ILIKE '%login%' OR action ILIKE '%password%' OR action ILIKE '%auth%';

-- 3. Sample recent activity logs related to authentication
SELECT 
  'Recent Auth Activity' as analysis_type,
  al.action,
  al.timestamp,
  u.email as user_email,
  al.ip_address,
  o.code as org_code
FROM activity_logs al
LEFT JOIN users u ON al.user_id::text = u.id::text
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE al.action ILIKE '%login%' 
   OR al.action ILIKE '%password%' 
   OR al.action ILIKE '%auth%'
ORDER BY al.timestamp DESC
LIMIT 10;

-- 4. Check if there are any password sync mechanisms or triggers
SELECT 
  'Password Sync Mechanisms' as analysis_type,
  proname as function_name,
  prosrc as function_source
FROM pg_proc
WHERE prosrc ILIKE '%password%'
   OR prosrc ILIKE '%auth%'
   OR proname ILIKE '%password%'
   OR proname ILIKE '%auth%'
ORDER BY proname;

-- KEY QUESTIONS TO ANSWER:
-- 1. How does login actually work? Database password vs Supabase Auth?
-- 2. Are there sync mechanisms between database and Supabase Auth?
-- 3. Why did Supabase Auth send the recovery email if we're using custom system?
-- 4. What happens during successful login - which password is verified?
-- 5. Are there any automatic triggers that sync passwords between systems?

-- NEXT STEPS AFTER ANALYSIS:
-- Based on results, we'll understand:
-- - If we need to disable Supabase Auth password reset completely
-- - Whether passwords must be updated in both places
-- - How to prevent Supabase Auth from sending recovery emails
-- - Proper architecture for custom Resend-based password reset
