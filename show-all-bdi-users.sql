-- Show all BDI users with their actual email addresses and privilege levels

SELECT 
  u.email,
  u.name,
  u.role,
  CASE 
    WHEN u.role = 'super_admin' THEN '👑 SUPER ADMIN'
    WHEN u.role = 'admin_cfo' THEN '💰 ADMIN CFO'
    WHEN u.role = 'admin' THEN '⚙️ ADMIN'
    WHEN u.role = 'operations' THEN '🔧 OPERATIONS'
    WHEN u.role = 'member' THEN '👤 MEMBER'
    WHEN u.role = 'viewer' THEN '👁️ VIEWER'
    ELSE u.role
  END as privileges,
  u.is_active,
  CASE 
    WHEN u.last_login_at IS NOT NULL THEN '✅ LOGGED IN'
    WHEN u.password_hash = 'invitation_pending' THEN '📧 PENDING'
    ELSE '⚠️ NEVER LOGGED IN'
  END as login_status
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE o.code = 'BDI'
  AND o.type = 'internal'
  AND u.is_active = true
  AND u.deleted_at IS NULL
ORDER BY 
  CASE u.role 
    WHEN 'super_admin' THEN 1
    WHEN 'admin_cfo' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'operations' THEN 4
    WHEN 'member' THEN 5
    WHEN 'viewer' THEN 6
    ELSE 7
  END,
  u.email;
