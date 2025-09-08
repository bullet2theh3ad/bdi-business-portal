-- Delete steve@spnnet.com user immediately
-- Based on user data: id: 0b0cdfa5-a614-45ab-a7aa-82db872a9bac, auth_id: 0e3a363b-9332-4c2e-a693-472b01135445

-- 1. Delete organization memberships first
DELETE FROM organization_members 
WHERE user_auth_id = '0e3a363b-9332-4c2e-a693-472b01135445';

-- 2. Delete the user record
DELETE FROM users 
WHERE email = 'steve@spnnet.com';

-- 3. Clean up any legacy invitations
DELETE FROM organization_invitations 
WHERE invited_email = 'steve@spnnet.com';

-- 4. Verify deletion
SELECT COUNT(*) as remaining_users FROM users WHERE email = 'steve@spnnet.com';

-- 5. Success
SELECT 'steve@spnnet.com is now available for invitation' as status;
