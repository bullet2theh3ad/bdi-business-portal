-- ============================================
-- SQL to Check MTN's Forecast Access
-- ============================================

-- 1. Find MTN Organization
-- ============================================
SELECT 
    id,
    code,
    name,
    type,
    cpfr_contacts
FROM organizations
WHERE code = 'MTN';

-- 2. Find MTN Users and Their Roles
-- ============================================
SELECT 
    u.id,
    u.name,
    u.email,
    u.role as user_role,
    u.is_active,
    om.role as org_membership_role,
    o.code as org_code,
    o.name as org_name,
    o.type as org_type
FROM users u
INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
INNER JOIN organizations o ON om.organization_uuid = o.id
WHERE o.code = 'MTN'
ORDER BY u.email;

-- 3. Find SKUs Owned by MTN (this determines what forecasts they can see)
-- ============================================
SELECT 
    id,
    sku,
    name,
    mfg,
    standard_cost
FROM product_skus
WHERE mfg = 'MTN'
ORDER BY sku;

-- 4. Count of SKUs by Manufacturer (to see MTN's share)
-- ============================================
SELECT 
    mfg,
    COUNT(*) as sku_count
FROM product_skus
GROUP BY mfg
ORDER BY sku_count DESC;

-- 5. Find ALL Forecasts for MTN's SKUs (what MTN can see)
-- ============================================
SELECT 
    sf.id as forecast_id,
    ps.sku,
    ps.name as product_name,
    ps.mfg,
    sf.quantity,
    sf.delivery_week,
    sf.shipping_preference,
    sf.status,
    sf.sales_signal,
    sf.factory_signal,
    sf.transit_signal,
    sf.warehouse_signal,
    u.name as created_by_user,
    u.email as created_by_email,
    sf.created_at
FROM sales_forecasts sf
INNER JOIN product_skus ps ON sf.sku_id = ps.id
LEFT JOIN users u ON sf.created_by = u.auth_id
WHERE ps.mfg = 'MTN'
ORDER BY sf.delivery_week DESC, sf.created_at DESC;

-- 6. Summary: MTN Forecast Visibility
-- ============================================
SELECT 
    'Total Forecasts in System' as metric,
    COUNT(*) as count
FROM sales_forecasts
UNION ALL
SELECT 
    'Forecasts MTN Can See' as metric,
    COUNT(*) as count
FROM sales_forecasts sf
INNER JOIN product_skus ps ON sf.sku_id = ps.id
WHERE ps.mfg = 'MTN'
UNION ALL
SELECT 
    'MTN SKUs in System' as metric,
    COUNT(*) as count
FROM product_skus
WHERE mfg = 'MTN'
UNION ALL
SELECT 
    'MTN Users' as metric,
    COUNT(DISTINCT u.id) as count
FROM users u
INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
INNER JOIN organizations o ON om.organization_uuid = o.id
WHERE o.code = 'MTN';

-- 7. Access Test: What specific user can see
-- ============================================
-- Replace 'user@mtn.com' with actual MTN user email
SELECT 
    u.email as user_email,
    o.code as user_org,
    o.type as org_type,
    COUNT(DISTINCT sf.id) as forecasts_visible
FROM users u
INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
INNER JOIN organizations o ON om.organization_uuid = o.id
LEFT JOIN product_skus ps ON ps.mfg = o.code
LEFT JOIN sales_forecasts sf ON sf.sku_id = ps.id
WHERE u.email ILIKE '%mtn%'  -- Find MTN users
GROUP BY u.email, o.code, o.type;

-- ============================================
-- KEY LOGIC EXPLANATION:
-- ============================================
-- 
-- 1. BDI Users (code='BDI', type='internal'):
--    - Can see ALL forecasts regardless of SKU manufacturer
--    - Roles: super_admin, admin, sales, member
--
-- 2. Partner Users (like MTN):
--    - Can ONLY see forecasts where:
--      sales_forecasts.sku_id → product_skus.mfg = 'MTN'
--    - This means MTN only sees forecasts for products THEY manufacture
--
-- 3. To give MTN access to specific forecasts:
--    - The SKU must have mfg = 'MTN' in product_skus table
--    - The user must be a member of the MTN organization
--    - The user must have an active account
--
-- ============================================

