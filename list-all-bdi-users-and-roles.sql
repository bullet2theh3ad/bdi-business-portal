-- List all BDI organization users with their roles

SELECT 
    u.id,
    u.email,
    u.name,
    u.role as system_role,
    om.role as org_role,
    o.name as organization_name,
    o.code as org_code,
    u.is_active,
    om.joined_at,
    u.last_login_at,
    u.created_at
FROM users u
INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
INNER JOIN organizations o ON om.organization_uuid = o.id
WHERE o.code = 'BDI' OR o.name ILIKE '%BDI%' OR o.name ILIKE '%Boundless%'
ORDER BY 
    CASE u.role
        WHEN 'super_admin' THEN 1
        WHEN 'admin_cfo' THEN 2
        WHEN 'admin_nre' THEN 3
        WHEN 'admin' THEN 4
        WHEN 'member' THEN 5
        ELSE 6
    END,
    CASE om.role
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'admin_cfo' THEN 3
        WHEN 'admin_nre' THEN 4
        WHEN 'member' THEN 5
        ELSE 6
    END,
    u.name;

-- Summary count by role
SELECT 
    o.name as organization,
    u.role as system_role,
    om.role as org_role,
    COUNT(*) as user_count
FROM users u
INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
INNER JOIN organizations o ON om.organization_uuid = o.id
WHERE o.code = 'BDI' OR o.name ILIKE '%BDI%' OR o.name ILIKE '%Boundless%'
GROUP BY o.name, u.role, om.role
ORDER BY o.name, user_count DESC;

