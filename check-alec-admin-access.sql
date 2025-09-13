-- Check if alec.deangelo@ol-usa.com has admin access and is active for login
SELECT 
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
  updated_at,
  deleted_at
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- Check access level and login status
SELECT 
  u.email,
  u.name,
  u.role,
  u.title,
  u.department,
  u.is_active,
  u.last_login_at,
  CASE 
    WHEN u.role = 'super_admin' THEN '✅ SUPER ADMIN ACCESS'
    WHEN u.role = 'admin' THEN '✅ ADMIN ACCESS'
    WHEN u.role = 'user' THEN '⚠️ USER ACCESS (limited)'
    ELSE '❌ UNKNOWN ROLE'
  END as access_level,
  CASE 
    WHEN u.is_active = true THEN '✅ ACTIVE - CAN LOGIN'
    WHEN u.is_active = false THEN '❌ INACTIVE - CANNOT LOGIN'
    ELSE '⚠️ UNKNOWN STATUS'
  END as login_status,
  CASE 
    WHEN u.deleted_at IS NULL THEN '✅ ACCOUNT EXISTS'
    ELSE '❌ ACCOUNT DELETED'
  END as account_status
FROM users u
WHERE u.email = 'alec.deangelo@ol-usa.com';

-- Check organization membership for OL
SELECT 
  u.email,
  u.name,
  u.role,
  o.name as organization_name,
  o.code as organization_code,
  o.type as organization_type,
  uo.membership_role,
  uo.joined_at
FROM users u
LEFT JOIN user_organizations uo ON u.auth_id = uo.user_auth_id
LEFT JOIN organizations o ON uo.organization_id = o.id
WHERE u.email = 'alec.deangelo@ol-usa.com';

-- Show all OL organization users for context
SELECT 
  u.email,
  u.name,
  u.role,
  u.is_active,
  o.name as organization_name,
  o.code as organization_code
FROM users u
LEFT JOIN user_organizations uo ON u.auth_id = uo.user_auth_id
LEFT JOIN organizations o ON uo.organization_id = o.id
WHERE o.code LIKE '%OL%' OR o.name ILIKE '%OL%'
ORDER BY u.created_at;

-- Check if there are any pending invitations for this email
SELECT 
  email,
  status,
  invited_at,
  invited_by,
  organization_id,
  role as invited_role
FROM invitations 
WHERE email = 'alec.deangelo@ol-usa.com'
ORDER BY invited_at DESC;
