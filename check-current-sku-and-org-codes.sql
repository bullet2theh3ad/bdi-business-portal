-- Check Current SKU and Organization Codes for PO Number Generation

-- 1. Check existing SKUs to see if they have any 3-digit codes
SELECT 
    sku,
    name,
    category,
    -- Check if SKU already has a pattern that could be a 3-digit code
    CASE 
        WHEN sku ~ '^[A-Z]{3}[0-9]+' THEN SUBSTRING(sku FROM 1 FOR 3)
        WHEN sku ~ '^[A-Z]{2}[0-9]+' THEN SUBSTRING(sku FROM 1 FOR 2) || '0'
        ELSE 'NO_CODE'
    END as potential_sku_code,
    created_at
FROM product_skus 
ORDER BY created_at
LIMIT 20;

-- 2. Check all organization codes that will need 2-digit assignments
SELECT 
    o.code as org_code,
    o.name as org_name,
    o.type as org_type,
    COUNT(om.user_auth_id) as member_count
FROM organizations o
LEFT JOIN organization_members om ON o.id = om.organization_uuid
GROUP BY o.code, o.name, o.type
ORDER BY o.code;

-- 3. Check if there are any existing patterns in PO numbers
SELECT 
    po_number,
    supplier_organization_id,
    created_at
FROM purchase_orders 
ORDER BY created_at DESC
LIMIT 10;

-- 4. Count total SKUs to see if we're within 999 limit
SELECT 
    COUNT(*) as total_skus,
    COUNT(DISTINCT sku) as unique_sku_codes,
    MIN(created_at) as oldest_sku,
    MAX(created_at) as newest_sku
FROM product_skus;

-- 5. Check organizations that will need 2-digit codes
SELECT 
    'Organization Code Assignments Needed:' as info,
    'MTN=10, CBN=20, ASK=30, ATL=40, BDI=90, CAT=80, GPN=70' as proposed_codes;
