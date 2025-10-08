-- Simple list of BDI users with names and roles

SELECT 
    u.name,
    u.email,
    COALESCE(om.role, u.role) as primary_role,
    u.role as system_role,
    om.role as org_role,
    u.is_active
FROM users u
INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
INNER JOIN organizations o ON om.organization_uuid = o.id
WHERE o.code = 'BDI' OR o.name ILIKE '%Boundless%'
ORDER BY 
    CASE COALESCE(om.role, u.role)
        WHEN 'super_admin' THEN 1
        WHEN 'owner' THEN 2
        WHEN 'admin_cfo' THEN 3
        WHEN 'admin_nre' THEN 4
        WHEN 'admin' THEN 5
        WHEN 'member' THEN 6
        ELSE 7
    END,
    u.name;

