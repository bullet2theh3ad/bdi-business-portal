-- ============================================================================
-- MANUAL SUPABASE AUTH USER CLEANUP
-- Run this in your Supabase SQL Editor to remove orphaned auth users
-- ============================================================================

-- Find the user in Supabase Auth by email
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'steve@cistulli.com';

-- Delete the user from Supabase Auth (this will allow email reuse)
DELETE FROM auth.users WHERE email = 'steve@cistulli.com';

-- Verify deletion
SELECT 'User removed from Supabase Auth' as status;
SELECT id, email FROM auth.users WHERE email = 'steve@cistulli.com';
