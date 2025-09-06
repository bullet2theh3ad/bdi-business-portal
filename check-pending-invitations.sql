-- Check what's in the organization_invitations table
SELECT 
    invitation_token,
    invited_email,
    invited_name,
    organization_code,
    status,
    created_at,
    expires_at
FROM organization_invitations 
WHERE invited_email = 'sales3@mtncn.com'
ORDER BY created_at DESC;

-- Check all pending organization invitations
SELECT 
    invitation_token,
    invited_email,
    invited_name,
    organization_code,
    status,
    created_at
FROM organization_invitations 
WHERE status = 'pending'
ORDER BY created_at DESC;
