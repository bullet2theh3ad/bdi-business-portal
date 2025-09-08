-- Add page access control to organizations table
-- This allows organization admins to control which pages their users can access

-- Add the enabled_pages column with default permissions
ALTER TABLE organizations 
ADD COLUMN enabled_pages JSONB DEFAULT '{
  "cpfr_forecasts": true,
  "cpfr_shipments": true,
  "cpfr_invoices": true,
  "cpfr_purchase_orders": true,
  "inventory_production_files": true,
  "inventory_warehouses": true,
  "organization_users": true,
  "organization_analytics": false
}';

-- Update existing organizations to have the default enabled pages
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
WHERE enabled_pages IS NULL;

-- For BDI (internal organization), enable all pages including analytics
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

-- Verify the changes
SELECT 
    code,
    name,
    type,
    enabled_pages
FROM organizations 
ORDER BY code;
