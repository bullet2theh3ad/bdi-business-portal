-- Check current BDI users to identify who to promote to Super Admin

SELECT 
    'CURRENT BDI USERS' as status,
    u.id,
    u.auth_id,
    u.email,
    u.name,
    u.role as system_role,
    u.is_active,
    om.role as org_role,
    o.code as org_code,
    o.name as org_name,
    u.created_at,
    u.last_login_at
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE o.code = 'BDI' 
  AND o.type = 'internal'
  AND u.is_active = true
ORDER BY u.created_at;

-- Show current Super Admins
SELECT 
    'CURRENT SUPER ADMINS' as status,
    email,
    name,
    role,
    is_active,
    created_at
FROM users 
WHERE role = 'super_admin' 
  AND is_active = true
ORDER BY created_at;
