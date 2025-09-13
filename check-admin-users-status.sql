-- Check admin status for both Alec and Steve (without user_organizations table)

-- Check Alec DeAngelo admin status
SELECT 
  'ALEC DEANGELO' as user_check,
  id,
  auth_id,
  name,
  email,
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
    ELSE '⚠️ UNKNOWN STATUS'
  END as login_status
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com'

UNION ALL

-- Check Steve Cistulli admin status  
SELECT 
  'STEVE CISTULLI' as user_check,
  id,
  auth_id,
  name,
  email,
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
    ELSE '⚠️ UNKNOWN STATUS'
  END as login_status
FROM users 
WHERE email = 'scistulli@premierss.com'

ORDER BY user_check;

-- Show all admin and super_admin users for comparison
SELECT 
  'ALL ADMINS' as section,
  email,
  name,
  role,
  title,
  is_active,
  created_at
FROM users 
WHERE role IN ('admin', 'super_admin')
ORDER BY role DESC, created_at;

-- Check for any pending invitations for these emails
SELECT 
  'PENDING INVITATIONS' as section,
  email,
  status,
  invited_at,
  invited_by,
  role as invited_role,
  organization_id
FROM invitations 
WHERE email IN ('alec.deangelo@ol-usa.com', 'scistulli@premierss.com')
ORDER BY invited_at DESC;

-- Check if these users exist but with different email variations
SELECT 
  'EMAIL VARIATIONS' as section,
  email,
  name,
  role,
  is_active
FROM users 
WHERE 
  email ILIKE '%alec%' OR 
  email ILIKE '%deangelo%' OR
  email ILIKE '%scistulli%' OR
  email ILIKE '%premierss%'
ORDER BY email;
