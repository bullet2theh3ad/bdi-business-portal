-- Debug the exact differences between MTN users that cause access issues

-- Check system roles and user status
SELECT 
    'SYSTEM ROLES COMPARISON' as status,
    email,
    name,
    role as system_role,
    is_active,
    supplier_code,
    password_hash,
    auth_id,
    created_at
FROM users 
WHERE email IN ('steve@cistulli.com', 'steve@spnnet.com', 'sales3@mtncn.com')
ORDER BY email;

-- Check what /api/user endpoint would return for each user
-- This simulates the organization assignment logic
SELECT 
    'API USER RESPONSE SIMULATION' as status,
    u.email,
    u.name,
    u.role as system_role,
    u.is_active,
    -- First organization (what gets set as user.organization)
    (
        SELECT o.code 
        FROM organization_members om2 
        JOIN organizations o ON om2.organization_uuid = o.id 
        WHERE om2.user_auth_id = u.auth_id 
        LIMIT 1
    ) as primary_org_code,
    (
        SELECT o.type 
        FROM organization_members om2 
        JOIN organizations o ON om2.organization_uuid = o.id 
        WHERE om2.user_auth_id = u.auth_id 
        LIMIT 1
    ) as primary_org_type,
    (
        SELECT om2.role 
        FROM organization_members om2 
        JOIN organizations o ON om2.organization_uuid = o.id 
        WHERE om2.user_auth_id = u.auth_id 
        LIMIT 1
    ) as primary_org_role
FROM users u
WHERE u.email IN ('steve@cistulli.com', 'steve@spnnet.com', 'sales3@mtncn.com')
ORDER BY u.email;

-- Check if there are any auth_id mismatches or duplicates
SELECT 
    'AUTH ID CHECK' as status,
    email,
    auth_id,
    COUNT(*) as auth_id_count
FROM users 
WHERE email IN ('steve@cistulli.com', 'steve@spnnet.com', 'sales3@mtncn.com')
GROUP BY email, auth_id
ORDER BY email;
