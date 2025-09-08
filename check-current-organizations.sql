-- Check current organizations for invitation testing
SELECT 
    code,
    name,
    type,
    created_at,
    id
FROM organizations 
ORDER BY created_at;

-- Check current users and their organization memberships
SELECT 
    u.email,
    u.name,
    u.role,
    u.is_active,
    o.code as org_code,
    o.name as org_name,
    om.role as org_role
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
ORDER BY u.created_at;
