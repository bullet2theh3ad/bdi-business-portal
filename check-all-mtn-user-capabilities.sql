-- Comprehensive check of all MTN users and their exact capabilities

-- 1. All MTN users with complete details
SELECT 
    'ALL MTN USERS DETAILED' as status,
    u.id as user_id,
    u.auth_id,
    u.email,
    u.name,
    u.role as system_role,
    u.is_active as user_active,
    u.supplier_code,
    om.role as org_role,
    o.code as org_code,
    o.name as org_name,
    o.id as org_uuid,
    u.created_at as user_created,
    u.last_login_at,
    u.password_hash
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email IN ('steve@cistulli.com', 'steve@spnnet.com', 'sales3@mtncn.com')
   OR (o.code = 'MTN' AND o.type = 'contractor')
ORDER BY u.email;

-- 2. Check which users are actually in MTN organization_members
SELECT 
    'MTN ORGANIZATION MEMBERS' as status,
    u.email,
    u.name,
    u.role as system_role,
    om.role as org_role,
    om.user_auth_id,
    om.organization_uuid
FROM organization_members om
JOIN users u ON om.user_auth_id = u.auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE o.code = 'MTN'
ORDER BY u.email;

-- 3. Check all organization memberships for these specific users
SELECT 
    'USER ORGANIZATION MEMBERSHIPS' as status,
    u.email,
    u.name,
    o.code as org_code,
    o.name as org_name,
    o.type as org_type,
    om.role as org_role,
    CASE 
        WHEN o.code = 'BDI' AND o.type = 'internal' THEN 'BDI_USER'
        WHEN o.code != 'BDI' THEN 'PARTNER_USER' 
        ELSE 'OTHER'
    END as user_type
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email IN ('steve@cistulli.com', 'steve@spnnet.com', 'sales3@mtncn.com')
ORDER BY u.email, o.code;

-- 4. Check MTN organization enabled_pages settings
SELECT 
    'MTN ENABLED PAGES' as status,
    code,
    name,
    type,
    enabled_pages,
    is_active
FROM organizations 
WHERE code = 'MTN';

-- 5. Check if any users have multiple organization memberships
SELECT 
    'MULTIPLE MEMBERSHIPS' as status,
    u.email,
    u.name,
    COUNT(om.id) as membership_count,
    STRING_AGG(o.code, ', ') as org_codes,
    STRING_AGG(om.role, ', ') as org_roles
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email IN ('steve@cistulli.com', 'steve@spnnet.com', 'sales3@mtncn.com')
GROUP BY u.id, u.email, u.name
HAVING COUNT(om.id) > 0
ORDER BY u.email;
