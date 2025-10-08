-- Elevate amartinez@boundlessdevice.com to admin_nre role

-- First, check current status
SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    om.role as org_role,
    o.name as organization_name,
    u.is_active,
    u.created_at
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'amartinez@boundlessdevice.com';

-- Update to admin_nre role in organization_members
UPDATE organization_members
SET 
    role = 'admin_nre'
WHERE user_auth_id = (
    SELECT auth_id 
    FROM users 
    WHERE email = 'amartinez@boundlessdevice.com'
)
AND organization_uuid = (
    SELECT id 
    FROM organizations 
    WHERE name = 'BDI' OR name = 'Boundless Devices'
    LIMIT 1
);

-- Verify the change
SELECT 
    u.id,
    u.email,
    u.name,
    u.role as system_role,
    om.role as org_role,
    o.name as organization_name,
    om.joined_at,
    u.is_active
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'amartinez@boundlessdevice.com';

