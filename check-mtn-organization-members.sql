-- Check MTN organization and all its members to debug access differences

-- MTN Organization Details
SELECT 
    'MTN ORGANIZATION' as status,
    id,
    code,
    name,
    legal_name,
    type,
    is_active,
    enabled_pages,
    created_at
FROM organizations 
WHERE code = 'MTN';

-- All MTN Members with their roles
SELECT 
    'MTN MEMBERS' as status,
    u.email,
    u.name,
    u.role as system_role,
    u.is_active as user_active,
    om.role as org_role,
    u.created_at as user_created,
    u.last_login_at
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE o.code = 'MTN' 
  AND o.type = 'contractor'
ORDER BY u.created_at;

-- Compare the MTN users (including Enya)
SELECT 
    'MTN USER COMPARISON' as status,
    u.email,
    u.name,
    u.role as system_role,
    u.is_active as user_active,
    u.supplier_code,
    om.role as org_role,
    o.code as org_code,
    o.name as org_name,
    o.type as org_type,
    u.created_at as user_created,
    u.last_login_at
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email IN ('steve@cistulli.com', 'steve@spnnet.com', 'sales3@mtncn.com')
ORDER BY u.email;

-- Check if both users have proper MTN membership
SELECT 
    'MTN MEMBERSHIP CHECK' as status,
    u.email,
    u.name,
    COUNT(om.id) as membership_count,
    STRING_AGG(DISTINCT o.code, ', ') as org_codes,
    STRING_AGG(DISTINCT om.role, ', ') as org_roles
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email IN ('steve@cistulli.com', 'steve@spnnet.com', 'sales3@mtncn.com')
GROUP BY u.id, u.email, u.name
ORDER BY u.email;

-- Check organization UUIDs and IDs for debugging
SELECT 
    'ORGANIZATION IDS' as status,
    code,
    name,
    id as uuid_id,
    type,
    created_at
FROM organizations 
WHERE code IN ('MTN', 'BDI')
ORDER BY code;
