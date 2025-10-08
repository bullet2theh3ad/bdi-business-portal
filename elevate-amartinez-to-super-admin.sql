-- Elevate amartinez@boundlessdevices.com to super_admin (system role)

-- First, check current status
SELECT 
    u.id,
    u.email,
    u.name,
    u.role as system_role,
    om.role as org_role,
    o.name as organization_name,
    u.is_active,
    u.created_at
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'amartinez@boundlessdevices.com';

-- Update to super_admin system role in users table
UPDATE users
SET 
    role = 'super_admin',
    updated_at = NOW()
WHERE email = 'amartinez@boundlessdevices.com';

-- Verify the change
SELECT 
    u.id,
    u.email,
    u.name,
    u.role as system_role,
    om.role as org_role,
    o.name as organization_name,
    u.updated_at,
    u.is_active
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'amartinez@boundlessdevices.com';

