-- Fix Alec's auth_id with circular foreign key constraint

-- STEP 1: Temporarily disable foreign key constraint checking
SET session_replication_role = replica;

-- STEP 2: Update users table with correct auth_id
UPDATE users 
SET 
  auth_id = '2890729a-5d8b-49ce-b87c-cd726efb801a',
  updated_at = NOW()
WHERE email = 'alec.deangelo@ol-usa.com';

-- STEP 3: Update organization_members table with correct auth_id
UPDATE organization_members 
SET 
  user_auth_id = '2890729a-5d8b-49ce-b87c-cd726efb801a'
WHERE user_auth_id = 'b697864c-9845-4c95-b792-e4e24112f326';

-- STEP 4: Re-enable foreign key constraint checking
SET session_replication_role = DEFAULT;

-- STEP 5: Verify both tables are now consistent
SELECT 
  'USERS TABLE VERIFICATION' as check,
  email,
  name,
  role,
  is_active,
  auth_id
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

SELECT 
  'ORGANIZATION_MEMBERS VERIFICATION' as check,
  user_auth_id,
  organization_uuid,
  created_at
FROM organization_members 
WHERE user_auth_id = '2890729a-5d8b-49ce-b87c-cd726efb801a';

-- STEP 6: Final authentication test
SELECT 
  'ALEC LOGIN TEST' as final_test,
  u.email,
  u.name,
  u.role,
  u.is_active,
  u.auth_id as our_auth_id,
  au.id as supabase_auth_id,
  au.email_confirmed_at,
  CASE 
    WHEN u.auth_id = au.id 
     AND au.email_confirmed_at IS NOT NULL 
     AND u.is_active = true
    THEN '✅ CAN LOGIN NOW'
    ELSE '❌ STILL BLOCKED'
  END as login_status
FROM users u
LEFT JOIN auth.users au ON u.auth_id = au.id
WHERE u.email = 'alec.deangelo@ol-usa.com';

-- STEP 7: Check if this fixed any other users with similar issues
SELECT 
  'OTHER USERS CHECK' as check,
  u.email,
  u.auth_id,
  au.id as supabase_id,
  CASE 
    WHEN u.auth_id = au.id THEN '✅ SYNCED'
    WHEN au.id IS NULL THEN '❌ NOT IN AUTH'
    ELSE '⚠️ STILL MISMATCHED'
  END as status
FROM users u
LEFT JOIN auth.users au ON u.email = au.email
WHERE u.is_active = true
AND u.role IN ('admin', 'super_admin')
ORDER BY status, u.email;
