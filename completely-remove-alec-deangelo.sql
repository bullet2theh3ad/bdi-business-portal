-- Completely remove alec.deangelo@ol-usa.com from ALL systems

-- STEP 1: Check current status before deletion
SELECT 
  'BEFORE DELETION CHECK' as check_type,
  'users table' as location,
  email,
  name,
  auth_id,
  role,
  is_active,
  created_at
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- Check organization memberships
SELECT 
  'BEFORE DELETION CHECK' as check_type,
  'organization_members table' as location,
  om.user_auth_id,
  om.organization_uuid,
  om.role,
  o.name as organization_name,
  o.code as organization_code
FROM organization_members om
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE om.user_auth_id IN (
  SELECT auth_id FROM users WHERE email = 'alec.deangelo@ol-usa.com'
);

-- Check Supabase auth table
SELECT 
  'BEFORE DELETION CHECK' as check_type,
  'auth.users table' as location,
  email,
  id as supabase_auth_id,
  email_confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- STEP 2: COMPLETE DELETION (in correct order to handle foreign keys)

-- Delete from organization_members first (foreign key dependency)
DELETE FROM organization_members 
WHERE user_auth_id IN (
  SELECT auth_id FROM users WHERE email = 'alec.deangelo@ol-usa.com'
);

-- Delete from users table
DELETE FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- Delete any organization_invitations records
DELETE FROM organization_invitations 
WHERE invited_email = 'alec.deangelo@ol-usa.com';

-- Delete from Supabase auth.users (the critical step to prevent future conflicts)
DELETE FROM auth.users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- STEP 3: Verify complete cleanup
SELECT 
  'AFTER DELETION VERIFICATION' as check_type,
  'users table' as table_name,
  COUNT(*) as remaining_records
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com'

UNION ALL

SELECT 
  'AFTER DELETION VERIFICATION' as check_type,
  'organization_members table' as table_name,
  COUNT(*) as remaining_records
FROM organization_members om
WHERE om.user_auth_id IN (
  SELECT auth_id FROM users WHERE email = 'alec.deangelo@ol-usa.com'
)

UNION ALL

SELECT 
  'AFTER DELETION VERIFICATION' as check_type,
  'organization_invitations table' as table_name,
  COUNT(*) as remaining_records
FROM organization_invitations 
WHERE invited_email = 'alec.deangelo@ol-usa.com'

UNION ALL

SELECT 
  'AFTER DELETION VERIFICATION' as check_type,
  'auth.users table' as table_name,
  COUNT(*) as remaining_records
FROM auth.users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- ALL COUNTS SHOULD BE 0 AFTER COMPLETE DELETION
-- This ensures alec.deangelo@ol-usa.com can be re-invited fresh without conflicts
