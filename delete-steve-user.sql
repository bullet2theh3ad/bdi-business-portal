-- Delete steve@spnnet.com user to test invitation system
-- This user exists and is blocking invitation testing

-- First, let's see the current state of steve@spnnet.com
SELECT 
    'CURRENT STEVE USER STATE' as check_type,
    u.id,
    u.auth_id,
    u.name,
    u.email,
    u.role,
    u.is_active,
    u.password_hash,
    o.code as org_code,
    o.name as org_name,
    om.role as org_role
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'steve@spnnet.com';

-- Delete organization membership first
DELETE FROM organization_members 
WHERE user_auth_id = (
    SELECT auth_id FROM users WHERE email = 'steve@spnnet.com'
);

-- Delete the user record
DELETE FROM users 
WHERE email = 'steve@spnnet.com';

-- Verify deletion
SELECT 
    'VERIFICATION - Should be empty' as check_type,
    COUNT(*) as remaining_records
FROM users 
WHERE email = 'steve@spnnet.com';

-- Also clean up the legacy organization invitation while we're at it
DELETE FROM organization_invitations 
WHERE invitation_token = 'BDI-1757355671937-nv62uct4o'
   OR invited_email = 'steve@spnnet.com';

-- Final verification
SELECT 
    'CLEANUP COMPLETE' as status,
    'steve@spnnet.com should now be available for invitation testing' as message;
