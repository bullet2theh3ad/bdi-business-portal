-- Debug user access issues for BDI members
-- Check if user exists and has organization membership

-- Check user exists
SELECT 
  u.id,
  u.auth_id,
  u.email,
  u.name,
  u.role,
  u.is_active
FROM users u 
WHERE u.email = 'scistulli@boundlessdevices.com'
ORDER BY u.created_at DESC;

-- Check organization membership
SELECT 
  om.id,
  om.user_auth_id,
  om.organization_uuid,
  om.role as membership_role,
  o.code as org_code,
  o.name as org_name,
  o.type as org_type
FROM organization_members om
JOIN organizations o ON o.id = om.organization_uuid
JOIN users u ON u.auth_id = om.user_auth_id
WHERE u.email = 'scistulli@boundlessdevices.com';

-- Check if BDI organization exists
SELECT 
  id,
  name,
  code,
  type,
  is_active
FROM organizations 
WHERE code = 'BDI' OR type = 'internal';

-- Check if sales_forecasts table exists
SELECT COUNT(*) as forecast_count FROM sales_forecasts;
