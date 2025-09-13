-- Simple check for both admin users without problematic tables

-- Check Alec DeAngelo admin status
SELECT 
  'ALEC DEANGELO' as user_check,
  email,
  name,
  role,
  title,
  department,
  is_active,
  last_login_at,
  created_at,
  CASE 
    WHEN role = 'super_admin' THEN '✅ SUPER ADMIN ACCESS'
    WHEN role = 'admin' THEN '✅ ADMIN ACCESS'
    WHEN role = 'user' THEN '⚠️ USER ACCESS (limited)'
    ELSE '❌ UNKNOWN ROLE'
  END as access_level,
  CASE 
    WHEN is_active = true THEN '✅ ACTIVE - CAN LOGIN'
    WHEN is_active = false THEN '❌ INACTIVE - CANNOT LOGIN'
  END as login_status
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com'

UNION ALL

-- Check Steve Cistulli admin status  
SELECT 
  'STEVE CISTULLI' as user_check,
  email,
  name,
  role,
  title,
  department,
  is_active,
  last_login_at,
  created_at,
  CASE 
    WHEN role = 'super_admin' THEN '✅ SUPER ADMIN ACCESS'
    WHEN role = 'admin' THEN '✅ ADMIN ACCESS'
    WHEN role = 'user' THEN '⚠️ USER ACCESS (limited)'
    ELSE '❌ UNKNOWN ROLE'
  END as access_level,
  CASE 
    WHEN is_active = true THEN '✅ ACTIVE - CAN LOGIN'
    WHEN is_active = false THEN '❌ INACTIVE - CANNOT LOGIN'
  END as login_status
FROM users 
WHERE email = 'scistulli@premierss.com'

ORDER BY user_check;

-- Show all admin users for comparison
SELECT 
  email,
  name,
  role,
  title,
  is_active,
  created_at
FROM users 
WHERE role IN ('admin', 'super_admin')
ORDER BY role DESC, created_at;

-- Check if these users exist with similar emails
SELECT 
  email,
  name,
  role,
  is_active
FROM users 
WHERE 
  email ILIKE '%alec%' OR 
  email ILIKE '%deangelo%' OR
  email ILIKE '%scistulli%' OR
  email ILIKE '%premierss%' OR
  email ILIKE '%ol-usa%'
ORDER BY email;
