-- STEP 1: Check what exists in Supabase auth for steve.cistulli@gmail.com

SELECT 
  'SUPABASE AUTH CHECK' as step,
  email,
  id as supabase_auth_id,
  email_confirmed_at,
  created_at,
  last_sign_in_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ CONFIRMED'
    ELSE '❌ NOT CONFIRMED'
  END as email_status
FROM auth.users 
WHERE email = 'steve.cistulli@gmail.com';

-- If this returns a row, that's why the invitation failed
-- The Supabase auth user already exists!
