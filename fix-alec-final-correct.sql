-- Final fix for Alec's auth_id with correct column names

-- STEP 1: Show current organization_members records for Alec (correct columns)
SELECT 
  'CURRENT ORG MEMBERSHIPS' as check,
  user_auth_id,
  organization_uuid,
  role,
  joined_at,
  is_active
FROM organization_members 
WHERE user_auth_id = 'b697864c-9845-4c95-b792-e4e24112f326';

-- STEP 2: Temporarily disable constraints to fix circular dependency
SET session_replication_role = replica;

-- STEP 3: Update users table with correct Supabase auth_id
UPDATE users 
SET 
  auth_id = '2890729a-5d8b-49ce-b87c-cd726efb801a'
WHERE email = 'alec.deangelo@ol-usa.com';

-- STEP 4: Update organization_members with correct auth_id
UPDATE organization_members 
SET 
  user_auth_id = '2890729a-5d8b-49ce-b87c-cd726efb801a'
WHERE user_auth_id = 'b697864c-9845-4c95-b792-e4e24112f326';

-- STEP 5: Re-enable constraints
SET session_replication_role = DEFAULT;

-- STEP 6: Verify users table is fixed
SELECT 
  'USERS TABLE FIXED' as status,
  email,
  name,
  role,
  is_active,
  auth_id
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- STEP 7: Verify organization_members is fixed (correct columns)
SELECT 
  'ORG MEMBERS FIXED' as status,
  user_auth_id,
  organization_uuid,
  role,
  is_active
FROM organization_members 
WHERE user_auth_id = '2890729a-5d8b-49ce-b87c-cd726efb801a';

-- STEP 8: Final authentication verification
SELECT 
  'ALEC FINAL LOGIN TEST' as final_test,
  u.email,
  u.name,
  u.role as user_role,
  u.is_active,
  u.auth_id,
  au.email_confirmed_at,
  au.last_sign_in_at,
  CASE 
    WHEN u.auth_id = au.id 
     AND au.email_confirmed_at IS NOT NULL 
     AND u.is_active = true
    THEN '✅ READY TO LOGIN'
    ELSE '❌ STILL BLOCKED'
  END as login_ready
FROM users u
LEFT JOIN auth.users au ON u.auth_id = au.id
WHERE u.email = 'alec.deangelo@ol-usa.com';
