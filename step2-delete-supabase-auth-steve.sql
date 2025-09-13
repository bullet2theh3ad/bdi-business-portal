-- STEP 2: Delete steve.cistulli@gmail.com from Supabase auth table

-- This will remove the Supabase auth user that's blocking the invitation
DELETE FROM auth.users 
WHERE email = 'steve.cistulli@gmail.com';

-- Verify deletion
SELECT 
  'VERIFICATION AFTER DELETE' as step,
  COUNT(*) as remaining_auth_users
FROM auth.users 
WHERE email = 'steve.cistulli@gmail.com';

-- Should return 0 remaining_auth_users
