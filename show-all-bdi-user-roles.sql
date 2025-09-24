-- Show roles of all BDI users
SELECT 
    u.name,
    u.email,
    u.role,
    u.is_active,
    u.last_login_at,
    u.created_at,
    o.name as organization_name,
    o.code as organization_code
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE o.code = 'BDI'
ORDER BY u.role DESC, u.name;
