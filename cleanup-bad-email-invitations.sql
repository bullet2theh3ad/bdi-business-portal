-- CLEANUP SCRIPT: Remove bad domain invitations to enable re-sending
-- ⚠️  IMPORTANT: Review the identify-bad-email-invitations.sql results first!
-- ⚠️  This script will delete pending invitations that used boundlessdevices.com

-- Step 1: Show what will be deleted (DRY RUN)
SELECT 
    'WILL BE DELETED - Organization Invitations' as action,
    oi.invited_email,
    oi.invited_name,
    oi.organization_code,
    oi.status,
    oi.created_at
FROM organization_invitations oi
WHERE oi.created_at < '2025-09-07 00:00:00'::timestamp
  AND oi.status = 'pending'
ORDER BY oi.created_at DESC;

SELECT 
    'WILL BE DELETED - User Invitations (pending only)' as action,
    u.email,
    u.name,
    u.role,
    u.created_at,
    o.code as organization_code
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE u.created_at < '2025-09-07 00:00:00'::timestamp
  AND u.created_at >= '2025-09-01 00:00:00'::timestamp
  AND u.password_hash = 'invitation_pending'  -- Only pending invitations
  AND u.is_active = false
ORDER BY u.created_at DESC;

-- UNCOMMENT THE FOLLOWING SECTIONS TO ACTUALLY DELETE (after reviewing above)

/*
-- Step 2: Delete pending organization invitations with bad domain
DELETE FROM organization_invitations 
WHERE created_at < '2025-09-07 00:00:00'::timestamp
  AND status = 'pending';

-- Step 3: Delete pending user invitations with bad domain
-- First get the user IDs to delete
WITH users_to_delete AS (
    SELECT u.id, u.auth_id
    FROM users u
    WHERE u.created_at < '2025-09-07 00:00:00'::timestamp
      AND u.created_at >= '2025-09-01 00:00:00'::timestamp
      AND u.password_hash = 'invitation_pending'
      AND u.is_active = false
)
-- Delete organization memberships first (foreign key constraint)
DELETE FROM organization_members 
WHERE user_auth_id IN (SELECT auth_id FROM users_to_delete);

-- Then delete the users
DELETE FROM users 
WHERE created_at < '2025-09-07 00:00:00'::timestamp
  AND created_at >= '2025-09-01 00:00:00'::timestamp
  AND password_hash = 'invitation_pending'
  AND is_active = false;
*/

-- Step 4: Verify cleanup (run after uncommenting above)
SELECT 
    'CLEANUP VERIFICATION' as status,
    'organization_invitations' as table_name,
    COUNT(*) as remaining_count
FROM organization_invitations oi
WHERE oi.created_at < '2025-09-07 00:00:00'::timestamp
  AND oi.status = 'pending'

UNION ALL

SELECT 
    'CLEANUP VERIFICATION' as status,
    'pending_users' as table_name,
    COUNT(*) as remaining_count
FROM users u
WHERE u.created_at < '2025-09-07 00:00:00'::timestamp
  AND u.created_at >= '2025-09-01 00:00:00'::timestamp
  AND u.password_hash = 'invitation_pending'
  AND u.is_active = false;
