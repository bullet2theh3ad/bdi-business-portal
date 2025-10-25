-- Elevate jeskelson@boundlessdevices.com to super_admin role
-- Run this in Supabase SQL Editor

-- First, let's check the current user details
SELECT 
    id,
    email,
    role,
    organization_id,
    created_at
FROM users
WHERE email = 'jeskelson@boundlessdevices.com';

-- Update the user's role to super_admin
UPDATE users
SET 
    role = 'super_admin',
    updated_at = NOW()
WHERE email = 'jeskelson@boundlessdevices.com';

-- Verify the update
SELECT 
    id,
    email,
    role,
    organization_id,
    created_at,
    updated_at
FROM users
WHERE email = 'jeskelson@boundlessdevices.com';

-- Show all super_admins for confirmation
SELECT 
    email,
    role,
    organization_id,
    created_at
FROM users
WHERE role = 'super_admin'
ORDER BY created_at DESC;


