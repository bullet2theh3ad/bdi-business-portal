-- Step 1: Check kdrennan@boundlessdevices.com user details before deletion
-- Verify user exists and check their current status in BDI organization

-- Check user details
SELECT 
  u.id as user_id,
  u.auth_id,
  u.name,
  u.email,
  u.role as system_role,
  u.title,
  u.department,
  u.is_active as user_active,
  u.last_login_at,
  u.created_at as user_created
FROM users u
WHERE u.email = 'kdrennan@boundlessdevices.com';

-- Check organization membership
SELECT 
  om.user_auth_id,
  om.organization_uuid,
  om.role as org_role,
  om.joined_at,
  om.is_active as membership_active,
  o.name as organization_name,
  o.code as org_code
FROM organization_members om
JOIN organizations o ON om.organization_uuid = o.id
JOIN users u ON om.user_auth_id = u.auth_id
WHERE u.email = 'kdrennan@boundlessdevices.com';

-- Check if user has any data associated (forecasts, files, etc.)
SELECT 
  'Data Check' as check_type,
  (SELECT COUNT(*) FROM sales_forecasts WHERE created_by = u.auth_id) as forecasts_created,
  (SELECT COUNT(*) FROM production_files WHERE uploaded_by = u.auth_id) as files_uploaded,
  (SELECT COUNT(*) FROM invoices WHERE created_by = u.auth_id) as invoices_created,
  (SELECT COUNT(*) FROM shipments WHERE created_by = u.auth_id) as shipments_created,
  (SELECT COUNT(*) FROM api_keys WHERE user_auth_id = u.auth_id) as api_keys_count
FROM users u
WHERE u.email = 'kdrennan@boundlessdevices.com';

-- Show summary
SELECT 
  'SUMMARY: kdrennan@boundlessdevices.com' as summary,
  CASE 
    WHEN EXISTS (SELECT 1 FROM users WHERE email = 'kdrennan@boundlessdevices.com') 
    THEN 'USER EXISTS - Ready for deletion'
    ELSE 'USER NOT FOUND - No action needed'
  END as status;
