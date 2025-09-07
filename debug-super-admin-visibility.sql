-- Check what invitations should be visible to Super Admin
SELECT 
    'All Organization Invitations' as type,
    organization_code,
    invited_email,
    invited_name,
    invited_role,
    status,
    created_at,
    invitation_token
FROM organization_invitations 
WHERE status = 'pending'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Check if there are any other invitation types
SELECT 
    'User Invitations' as type,
    u.email,
    u.name,
    u.role,
    u.is_active,
    u.password_hash,
    u.created_at,
    o.code as organization_code
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE u.is_active = false
  AND u.password_hash = 'invitation_pending'
  AND u.created_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY u.created_at DESC;
