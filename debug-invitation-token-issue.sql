-- Debug invitation token issue for steve.cistulli@gmail.com

-- STEP 1: Check if invitation record exists in organization_invitations table
SELECT 
  'INVITATION RECORD CHECK' as check_type,
  id,
  invited_email,
  invited_name,
  invited_role,
  invitation_token,
  status,
  created_at,
  expires_at,
  accepted_at,
  organization_id,
  organization_code
FROM organization_invitations 
WHERE invited_email = 'steve.cistulli@gmail.com'
ORDER BY created_at DESC
LIMIT 5;

-- STEP 2: Decode the token from the logs to see what it contains
-- Token from logs: eyJvcmdJZCI6Ijg3MGZjMmViLTI3ZTctNDJiNS1hNDc2LTgxNWZkZmYyZmE3YyIsImVtYWlsIjoic3RldmUuY2lzdHVsbGlAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwidHMiOjE3NTc3NjYwNjkzMzd9
-- This decodes to: {"orgId":"870fc2eb-27e7-42b5-a476-815fdff2fa7c","email":"steve.cistulli@gmail.com","role":"admin","ts":1757766069337}

-- STEP 3: Check if there are any expired invitations
SELECT 
  'EXPIRED INVITATIONS CHECK' as check_type,
  COUNT(*) as total_invitations,
  COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_invitations,
  COUNT(CASE WHEN expires_at >= NOW() THEN 1 END) as active_invitations
FROM organization_invitations 
WHERE invited_email = 'steve.cistulli@gmail.com';

-- STEP 4: Check if user exists in auth.users (Supabase auth table)
SELECT 
  'SUPABASE AUTH CHECK' as check_type,
  email,
  id as supabase_auth_id,
  email_confirmed_at,
  created_at,
  last_sign_in_at,
  raw_user_meta_data
FROM auth.users 
WHERE email = 'steve.cistulli@gmail.com';

-- STEP 5: Check if user exists in our users table
SELECT 
  'DATABASE USER CHECK' as check_type,
  email,
  name,
  auth_id,
  role,
  is_active,
  created_at
FROM users 
WHERE email = 'steve.cistulli@gmail.com';

-- STEP 6: Check organization membership
SELECT 
  'ORGANIZATION MEMBERSHIP CHECK' as check_type,
  om.user_auth_id,
  om.organization_uuid,
  om.role,
  o.name as organization_name,
  o.code as organization_code
FROM organization_members om
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE om.user_auth_id IN (
  SELECT auth_id FROM users WHERE email = 'steve.cistulli@gmail.com'
  UNION
  SELECT id FROM auth.users WHERE email = 'steve.cistulli@gmail.com'
);

-- STEP 7: Check all recent invitation activity
SELECT 
  'RECENT INVITATION ACTIVITY' as check_type,
  invited_email,
  status,
  created_at,
  expires_at,
  accepted_at,
  LEFT(invitation_token, 50) || '...' as token_preview
FROM organization_invitations 
WHERE created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;

-- STEP 8: Check for any signup errors or logs
-- (This would require checking application logs, but let's see if there are any patterns)
SELECT 
  'TOKEN ANALYSIS' as check_type,
  invited_email,
  LENGTH(invitation_token) as token_length,
  status,
  CASE 
    WHEN expires_at < NOW() THEN 'EXPIRED'
    WHEN expires_at >= NOW() THEN 'ACTIVE'
  END as token_status,
  expires_at,
  created_at
FROM organization_invitations 
WHERE invited_email = 'steve.cistulli@gmail.com';
