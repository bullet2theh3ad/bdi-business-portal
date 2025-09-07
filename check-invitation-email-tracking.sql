-- Check current invitation tracking data
-- This will help us see what we can determine about email domains used

-- 1. Check organization_invitations table (Super Admin invitations)
SELECT 
    'organization_invitations' as invitation_type,
    invited_email,
    organization_code,
    status,
    created_at,
    accepted_at,
    CASE 
        WHEN created_at >= '2025-09-07 00:00:00'::timestamp THEN 'likely_bdibusinessportal.com'
        ELSE 'likely_boundlessdevices.com'
    END as probable_sender_domain
FROM organization_invitations 
ORDER BY created_at DESC;

-- 2. Check users table for invitation-based users
SELECT 
    'user_invitations' as invitation_type,
    email,
    role,
    created_at,
    is_active,
    CASE 
        WHEN password_hash = 'invitation_pending' THEN 'pending'
        ELSE 'accepted'
    END as status,
    CASE 
        WHEN created_at >= '2025-09-07 00:00:00'::timestamp THEN 'likely_bdibusinessportal.com'
        ELSE 'likely_boundlessdevices.com'
    END as probable_sender_domain
FROM users 
WHERE created_at >= '2025-09-01 00:00:00'::timestamp  -- Recent invitations only
ORDER BY created_at DESC;

-- 3. Summary by probable domain
SELECT 
    probable_sender_domain,
    invitation_type,
    COUNT(*) as invitation_count,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN status != 'pending' THEN 1 END) as accepted_count
FROM (
    SELECT 
        'organization_invitations' as invitation_type,
        status,
        CASE 
            WHEN created_at >= '2025-09-07 00:00:00'::timestamp THEN 'bdibusinessportal.com'
            ELSE 'boundlessdevices.com'
        END as probable_sender_domain
    FROM organization_invitations 
    
    UNION ALL
    
    SELECT 
        'user_invitations' as invitation_type,
        CASE 
            WHEN password_hash = 'invitation_pending' THEN 'pending'
            ELSE 'accepted'
        END as status,
        CASE 
            WHEN created_at >= '2025-09-07 00:00:00'::timestamp THEN 'bdibusinessportal.com'
            ELSE 'boundlessdevices.com'
        END as probable_sender_domain
    FROM users 
    WHERE created_at >= '2025-09-01 00:00:00'::timestamp
) combined
GROUP BY probable_sender_domain, invitation_type
ORDER BY probable_sender_domain, invitation_type;
