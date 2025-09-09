-- Complete debugging for steve@spnnet.com access issues

-- 1. Current user status after fixes
SELECT 
    'STEVE SPNNET CURRENT STATUS' as status,
    id,
    auth_id,
    email,
    name,
    role as system_role,
    is_active,
    supplier_code,
    password_hash,
    created_at,
    updated_at,
    last_login_at
FROM users 
WHERE email = 'steve@spnnet.com';

-- 2. Organization membership details
SELECT 
    'STEVE SPNNET MEMBERSHIP' as status,
    u.email,
    u.name,
    om.user_auth_id,
    om.organization_uuid,
    om.role as org_role,
    o.id as org_id,
    o.code as org_code,
    o.name as org_name,
    o.type as org_type,
    o.enabled_pages
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'steve@spnnet.com';

-- 3. Compare with working user (steve@cistulli.com)
SELECT 
    'WORKING VS BLOCKED COMPARISON' as status,
    u.email,
    u.role as system_role,
    u.supplier_code,
    u.is_active,
    om.role as org_role,
    o.code as org_code,
    o.enabled_pages->'cpfr_forecasts' as forecasts_enabled,
    o.enabled_pages->'cpfr_purchase_orders' as po_enabled,
    o.enabled_pages->'inventory_warehouses' as warehouses_enabled
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email IN ('steve@cistulli.com', 'steve@spnnet.com')
ORDER BY u.email;

-- 4. Check if there are auth_id mismatches
SELECT 
    'AUTH ID VERIFICATION' as status,
    u.email,
    u.auth_id as users_auth_id,
    om.user_auth_id as membership_auth_id,
    CASE 
        WHEN u.auth_id = om.user_auth_id THEN 'MATCH'
        ELSE 'MISMATCH'
    END as auth_id_status
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
WHERE u.email = 'steve@spnnet.com';

-- 5. Simulate what /api/user endpoint should return for steve@spnnet.com
SELECT 
    'API USER SIMULATION FOR STEVE SPNNET' as status,
    u.id,
    u.auth_id,
    u.email,
    u.name,
    u.role,
    u.supplier_code,
    u.is_active,
    -- First organization (what becomes user.organization)
    (
        SELECT jsonb_build_object(
            'id', o.id,
            'code', o.code,
            'name', o.name,
            'type', o.type
        )
        FROM organization_members om2 
        JOIN organizations o ON om2.organization_uuid = o.id 
        WHERE om2.user_auth_id = u.auth_id 
        LIMIT 1
    ) as primary_organization,
    -- All organizations
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'organization', jsonb_build_object(
                    'id', o.id,
                    'code', o.code,
                    'name', o.name,
                    'type', o.type
                ),
                'membershipRole', om2.role
            )
        )
        FROM organization_members om2 
        JOIN organizations o ON om2.organization_uuid = o.id 
        WHERE om2.user_auth_id = u.auth_id
    ) as all_organizations
FROM users u
WHERE u.email = 'steve@spnnet.com';
