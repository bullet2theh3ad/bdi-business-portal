-- ============================================
-- SQL to Investigate SHE Organization
-- ============================================

-- 1. Get SHE Organization Details
-- ============================================
SELECT 
    id,
    code,
    name,
    legal_name,
    type,
    duns_number,
    tax_id,
    industry_code,
    company_size,
    business_address,
    cpfr_contacts,
    created_at,
    updated_at
FROM organizations
WHERE code = 'SHE';

-- 2. Find All Users in SHE Organization
-- ============================================
SELECT 
    u.id,
    u.name,
    u.email,
    u.role as user_role,
    u.is_active,
    u.title,
    u.department,
    om.role as org_membership_role,
    u.created_at,
    u.last_login_at
FROM users u
INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
INNER JOIN organizations o ON om.organization_uuid = o.id
WHERE o.code = 'SHE'
ORDER BY u.email;

-- 3. Check if SHE has any SKUs assigned to them
-- ============================================
SELECT 
    id,
    sku,
    name,
    mfg,
    standard_cost
FROM product_skus
WHERE mfg = 'SHE'
ORDER BY sku;

-- 4. Count SKUs for comparison
-- ============================================
SELECT 
    'SHE SKUs' as metric,
    COUNT(*) as count
FROM product_skus
WHERE mfg = 'SHE'
UNION ALL
SELECT 
    'MTN SKUs' as metric,
    COUNT(*) as count
FROM product_skus
WHERE mfg = 'MTN'
UNION ALL
SELECT 
    'BDI SKUs' as metric,
    COUNT(*) as count
FROM product_skus
WHERE mfg = 'BDI';

-- 5. Check all organizations with type 'internal'
-- ============================================
SELECT 
    o.code,
    o.name,
    o.type,
    COUNT(DISTINCT ps.id) as sku_count
FROM organizations o
LEFT JOIN product_skus ps ON ps.mfg = o.code
WHERE o.type = 'internal'
GROUP BY o.code, o.name, o.type
ORDER BY o.code;

-- 6. Find any connection between SHE and MTN
-- ============================================
-- Check if there are users with @mtncn.com email in SHE org
SELECT 
    u.email,
    u.name,
    o.code as org_code,
    o.type as org_type
FROM users u
INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
INNER JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email ILIKE '%mtncn.com%'
ORDER BY o.code, u.email;

-- ============================================
-- ANALYSIS NOTES:
-- ============================================
-- From the forecast access query, we saw:
-- - sales9@mtncn.com is in "SHE" org (type: internal)
-- - SHE has 0 forecasts visible
--
-- Questions to answer:
-- 1. Is SHE another manufacturer/contractor like MTN?
-- 2. Why is a @mtncn.com email in SHE organization?
-- 3. Does SHE have any SKUs assigned?
-- 4. Is SHE an internal organization like BDI?
-- ============================================

