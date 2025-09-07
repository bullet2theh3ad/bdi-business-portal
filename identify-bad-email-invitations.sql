-- Identify users who received invitations with boundlessdevices.com domain
-- These are candidates for re-sending with the correct domain

-- 1. Find users who got bad domain emails (created before our fix on 2025-09-07)
SELECT 
    'user_invitation' as invitation_type,
    u.id as user_id,
    u.name,
    u.email,
    u.role,
    u.title,
    u.department,
    u.is_active,
    u.created_at,
    u.last_login_at,
    CASE 
        WHEN u.password_hash = 'invitation_pending' THEN 'pending'
        WHEN u.last_login_at IS NOT NULL THEN 'accepted_and_active'
        ELSE 'accepted_but_not_logged_in'
    END as current_status,
    om.organization_uuid,
    o.name as organization_name,
    o.code as organization_code
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE u.created_at < '2025-09-07 00:00:00'::timestamp
  AND u.created_at >= '2025-09-01 00:00:00'::timestamp  -- Recent invitations only
ORDER BY u.created_at DESC;

-- 2. Find organization invitations that got bad domain emails
SELECT 
    'organization_invitation' as invitation_type,
    oi.id,
    oi.invited_name,
    oi.invited_email,
    oi.invited_role,
    oi.organization_code,
    oi.status,
    oi.created_at,
    oi.accepted_at,
    CASE 
        WHEN oi.status = 'pending' AND oi.created_at < '2025-09-07 00:00:00'::timestamp THEN 'needs_resend'
        WHEN oi.status = 'accepted' THEN 'already_accepted'
        ELSE 'recent_good_email'
    END as action_needed
FROM organization_invitations oi
WHERE oi.created_at < '2025-09-07 00:00:00'::timestamp
ORDER BY oi.created_at DESC;

-- 3. Summary of actions needed
SELECT 
    'SUMMARY' as type,
    action_needed,
    COUNT(*) as count,
    string_agg(DISTINCT email, ', ') as email_list
FROM (
    -- User invitations
    SELECT 
        u.email,
        CASE 
            WHEN u.password_hash = 'invitation_pending' THEN 'user_needs_resend'
            WHEN u.last_login_at IS NOT NULL THEN 'user_active_no_action'
            ELSE 'user_accepted_not_active'
        END as action_needed
    FROM users u
    WHERE u.created_at < '2025-09-07 00:00:00'::timestamp
      AND u.created_at >= '2025-09-01 00:00:00'::timestamp
    
    UNION ALL
    
    -- Organization invitations  
    SELECT 
        oi.invited_email as email,
        CASE 
            WHEN oi.status = 'pending' THEN 'org_needs_resend'
            WHEN oi.status = 'accepted' THEN 'org_accepted_no_action'
            ELSE 'org_other'
        END as action_needed
    FROM organization_invitations oi
    WHERE oi.created_at < '2025-09-07 00:00:00'::timestamp
) combined
GROUP BY action_needed
ORDER BY action_needed;
