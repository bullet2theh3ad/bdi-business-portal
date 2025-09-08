-- Update existing organizations with proper page access settings
-- Since enabled_pages column already exists, just set the values

-- Set default page access for all external organizations
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
WHERE enabled_pages IS NULL 
   OR enabled_pages = '{}' 
   OR enabled_pages = 'null';

-- For BDI (internal organization), enable all pages including admin pages
UPDATE organizations 
SET enabled_pages = '{
  "cpfr_forecasts": true,
  "cpfr_shipments": true,
  "cpfr_invoices": true,
  "cpfr_purchase_orders": true,
  "inventory_production_files": true,
  "inventory_warehouses": true,
  "organization_users": true,
  "organization_analytics": true,
  "admin_organizations": true,
  "admin_users": true,
  "admin_connections": true,
  "admin_analytics": true,
  "admin_skus": true
}'
WHERE code = 'BDI' AND type = 'internal';

-- Verify the settings
SELECT 
    'ORGANIZATION PAGE SETTINGS' as status,
    code,
    name,
    type,
    enabled_pages
FROM organizations 
ORDER BY code;
