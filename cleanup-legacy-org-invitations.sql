-- Clean up legacy organization invitations that are no longer supported
-- These were created by the old bulk invitation system we just removed

-- First, let's see what legacy invitations exist
SELECT 
    'LEGACY ORGANIZATION INVITATIONS TO CLEAN' as action,
    invitation_token,
    invited_email,
    invited_name,
    organization_code,
    status,
    created_at,
    expires_at
FROM organization_invitations 
ORDER BY created_at DESC;

-- Remove all pending organization invitations since we no longer support this flow
-- Users will need to be invited through the proper organization admin flow instead
DELETE FROM organization_invitations 
WHERE status = 'pending';

-- Verify cleanup
SELECT 
    'REMAINING ORGANIZATION INVITATIONS' as status,
    COUNT(*) as count,
    status
FROM organization_invitations 
GROUP BY status;

-- Note: Going forward, all user invitations should go through:
-- 1. Super Admin org setup: /api/admin/organizations/invite  
-- 2. Org Admin user invites: /api/organization/users/invite
