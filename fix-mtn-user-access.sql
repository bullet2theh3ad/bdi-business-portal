-- Fix MTN user access issues by updating supplier_code and enabled_pages

-- 1. Update supplier_code for all MTN users to match their organization
UPDATE users 
SET supplier_code = 'MTN'
WHERE auth_id IN (
    SELECT om.user_auth_id 
    FROM organization_members om 
    JOIN organizations o ON om.organization_uuid = o.id 
    WHERE o.code = 'MTN'
)
AND supplier_code IS NULL;

-- 2. Ensure MTN organization has all necessary enabled_pages
UPDATE organizations 
SET enabled_pages = '{
  "cpfr_forecasts": true,
  "cpfr_shipments": true,
  "cpfr_invoices": true,
  "cpfr_purchase_orders": true,
  "inventory_production_files": true,
  "inventory_warehouses": true,
  "organization_users": true,
  "organization_analytics": false
}'
WHERE code = 'MTN' 
  AND type = 'contractor';

-- 3. Verify the fixes
SELECT 
    'FIXED MTN USERS' as status,
    u.email,
    u.name,
    u.role as system_role,
    u.supplier_code,
    u.is_active,
    om.role as org_role,
    o.code as org_code
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE o.code = 'MTN'
ORDER BY u.email;

-- 4. Verify MTN enabled_pages
SELECT 
    'MTN ENABLED PAGES FIXED' as status,
    code,
    name,
    type,
    enabled_pages,
    is_active
FROM organizations 
WHERE code = 'MTN';

-- 5. Test access for specific routes
SELECT 
    'ACCESS TEST' as status,
    'MTN should now have access to:' as note,
    'cpfr_forecasts: ' || COALESCE((enabled_pages->>'cpfr_forecasts')::text, 'false') as forecasts_access,
    'cpfr_purchase_orders: ' || COALESCE((enabled_pages->>'cpfr_purchase_orders')::text, 'false') as po_access,
    'inventory_warehouses: ' || COALESCE((enabled_pages->>'inventory_warehouses')::text, 'false') as warehouse_access,
    'cpfr_invoices: ' || COALESCE((enabled_pages->>'cpfr_invoices')::text, 'false') as invoice_access,
    'cpfr_shipments: ' || COALESCE((enabled_pages->>'cpfr_shipments')::text, 'false') as shipment_access
FROM organizations 
WHERE code = 'MTN';
