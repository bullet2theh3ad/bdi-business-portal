-- List all users with their email, organization, and access level
-- Run this in Supabase SQL Editor

-- Comprehensive user list with organization details
SELECT 
    u.email,
    u.role AS access_level,
    om.role AS org_member_role,
    o.code AS org_code,
    o.name AS org_name,
    u.created_at AS user_created,
    u.last_login_at AS last_login,
    CASE 
        WHEN u.role = 'super_admin' THEN '🔴 Super Admin (Full System Access)'
        WHEN u.role = 'admin' THEN '🟠 Admin (Org-level Admin)'
        WHEN u.role = 'user' THEN '🟢 User (Standard Access)'
        WHEN u.role = 'developer' THEN '🔵 Developer (API Access)'
        WHEN u.role = 'member' THEN '🟢 Member (Standard Access)'
        ELSE '⚪ ' || u.role
    END AS access_description
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
ORDER BY 
    CASE u.role
        WHEN 'super_admin' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'developer' THEN 3
        WHEN 'user' THEN 4
        WHEN 'member' THEN 5
        ELSE 6
    END,
    o.code,
    u.email;

-- Summary by role
SELECT 
    role AS access_level,
    COUNT(*) AS user_count
FROM users
GROUP BY role
ORDER BY 
    CASE role
        WHEN 'super_admin' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'developer' THEN 3
        WHEN 'user' THEN 4
        WHEN 'member' THEN 5
        ELSE 6
    END;

-- Summary by organization
SELECT 
    o.code AS org_code,
    o.name AS org_name,
    COUNT(DISTINCT u.id) AS user_count,
    COUNT(DISTINCT CASE WHEN u.role = 'admin' THEN u.id END) AS admin_count,
    COUNT(DISTINCT CASE WHEN u.role IN ('user', 'member') THEN u.id END) AS user_count_regular,
    COUNT(DISTINCT CASE WHEN u.role = 'developer' THEN u.id END) AS developer_count,
    COUNT(DISTINCT CASE WHEN u.role = 'super_admin' THEN u.id END) AS superadmin_count
FROM organizations o
LEFT JOIN organization_members om ON o.id = om.organization_uuid
LEFT JOIN users u ON om.user_auth_id = u.auth_id
GROUP BY o.id, o.code, o.name
ORDER BY o.code;

