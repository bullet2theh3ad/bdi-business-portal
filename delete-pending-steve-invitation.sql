-- Delete the pending invitation for steve@spnnet.com
-- User ID: 0b0cdfa5-a614-45ab-a7aa-82db872a9bac
-- Auth ID: 0e3a363b-9332-4c2e-a693-472b01135445

-- 1. Show the pending invitation details
SELECT 
    'PENDING INVITATION TO DELETE' as action,
    u.id,
    u.auth_id,
    u.email,
    u.name,
    u.role,
    u.is_active,
    u.password_hash,
    u.created_at,
    o.code as org_code,
    o.name as org_name
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'steve@spnnet.com'
  AND u.password_hash = 'invitation_pending'
  AND u.is_active = false;

-- 2. Delete organization membership for this pending invitation
DELETE FROM organization_members 
WHERE user_auth_id = '0e3a363b-9332-4c2e-a693-472b01135445';

-- 3. Delete the pending user record
DELETE FROM users 
WHERE id = '0b0cdfa5-a614-45ab-a7aa-82db872a9bac'
  AND email = 'steve@spnnet.com'
  AND password_hash = 'invitation_pending';

-- 4. Clean up any related legacy invitation tokens
DELETE FROM organization_invitations 
WHERE invited_email = 'steve@spnnet.com';

-- 5. Final verification - should be completely clean
SELECT 
    'VERIFICATION - Should be empty' as result,
    COUNT(*) as user_count
FROM users 
WHERE email = 'steve@spnnet.com';

SELECT 
    'VERIFICATION - Should be empty' as result,
    COUNT(*) as membership_count
FROM organization_members 
WHERE user_auth_id = '0e3a363b-9332-4c2e-a693-472b01135445';

-- 6. Confirm steve@spnnet.com is now available for fresh invitation
SELECT 'steve@spnnet.com is now available for fresh invitation testing' as status;
