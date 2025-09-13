-- Promote sjin@boundlessdevices.com to super_admin

-- STEP 1: Check if user exists
SELECT 
  'CURRENT STATUS CHECK' as check_type,
  email,
  name,
  role,
  auth_id,
  is_active,
  created_at
FROM users 
WHERE email = 'sjin@boundlessdevices.com';

-- STEP 2: Check Supabase auth status
SELECT 
  'SUPABASE AUTH CHECK' as check_type,
  email,
  id as supabase_auth_id,
  email_confirmed_at,
  created_at
FROM auth.users 
WHERE email = 'sjin@boundlessdevices.com';

-- STEP 3: Promote to super_admin
UPDATE users 
SET 
  role = 'super_admin',
  updated_at = NOW()
WHERE email = 'sjin@boundlessdevices.com';

-- STEP 4: Verify promotion
SELECT 
  'PROMOTION VERIFICATION' as check_type,
  email,
  name,
  role,
  is_active,
  updated_at
FROM users 
WHERE email = 'sjin@boundlessdevices.com';

-- STEP 5: Check organization memberships (should show admin role in org)
SELECT 
  'ORGANIZATION MEMBERSHIP' as check_type,
  om.role as org_role,
  o.name as organization_name,
  o.code as organization_code
FROM organization_members om
LEFT JOIN organizations o ON om.organization_uuid = o.id
LEFT JOIN users u ON om.user_auth_id = u.auth_id
WHERE u.email = 'sjin@boundlessdevices.com';

-- Expected result: sjin@boundlessdevices.com should now have role = 'super_admin'
