-- Fix steve.cistulli@gmail.com auth mismatch (same issue as Alec had)

-- STEP 1: Check if there's a Supabase auth user for this email
SELECT 
  'STEVE GMAIL AUTH CHECK' as check,
  email,
  id as supabase_auth_id,
  email_confirmed_at,
  created_at
FROM auth.users 
WHERE email = 'steve.cistulli@gmail.com';

-- STEP 2: Check current database record
SELECT 
  'STEVE GMAIL DATABASE RECORD' as check,
  email,
  name,
  auth_id as current_auth_id,
  role,
  is_active,
  created_at
FROM users 
WHERE email = 'steve.cistulli@gmail.com';

-- STEP 3: If Supabase auth user exists, fix the auth_id mismatch
-- (Replace CORRECT_SUPABASE_AUTH_ID with the actual ID from STEP 1)
/*
-- First update organization_members
UPDATE organization_members 
SET user_auth_id = 'CORRECT_SUPABASE_AUTH_ID'
WHERE user_auth_id = (SELECT auth_id FROM users WHERE email = 'steve.cistulli@gmail.com');

-- Then update users table
UPDATE users 
SET auth_id = 'CORRECT_SUPABASE_AUTH_ID'
WHERE email = 'steve.cistulli@gmail.com';
*/

-- STEP 4: If no Supabase auth user exists, this user needs to sign up properly
-- Check if we should delete the broken database record and let them sign up fresh
SELECT 
  'RECOMMENDATION' as action,
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'steve.cistulli@gmail.com')
    THEN 'Fix auth_id mismatch using the ID from STEP 1'
    ELSE 'Delete broken database record and let user sign up fresh'
  END as recommended_action;
