-- Check Alec's login status and password hash
-- Determine if he should sign up or sign in

-- 1. Check Alec's current status for login capability
SELECT 
    'Alec Login Status Check' as check_type,
    id,
    auth_id,
    name,
    email,
    role,
    password_hash,
    is_active,
    title,
    department,
    reset_token,
    reset_token_expiry,
    created_at,
    updated_at,
    CASE 
        WHEN password_hash = 'invitation_pending' THEN 'NEEDS_SIGNUP - Must complete invitation'
        WHEN password_hash = 'supabase_managed' THEN 'CAN_LOGIN - Password managed by Supabase'
        WHEN password_hash IS NULL THEN 'NO_PASSWORD - Cannot login'
        WHEN LENGTH(password_hash) > 20 THEN 'HAS_HASH - Can potentially login'
        ELSE 'UNKNOWN_STATUS'
    END as login_capability,
    CASE 
        WHEN is_active = true THEN 'ACTIVE - Can access portal'
        WHEN is_active = false THEN 'INACTIVE - Cannot access portal'
        ELSE 'UNKNOWN'
    END as account_status
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- 2. Check if there's a Supabase auth user that might be created
SELECT 
    'Alec Auth Status' as check_type,
    auth_id,
    email,
    password_hash,
    is_active,
    CASE 
        WHEN password_hash = 'invitation_pending' AND is_active = false THEN 'PENDING_INVITATION'
        WHEN password_hash = 'supabase_managed' AND is_active = true THEN 'READY_TO_LOGIN'
        WHEN password_hash = 'supabase_managed' AND is_active = false THEN 'SUPABASE_USER_INACTIVE'
        ELSE 'OTHER_STATUS'
    END as auth_status
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- 3. Check organization membership status
SELECT 
    'Alec Membership Status' as check_type,
    om.role as membership_role,
    om.joined_at,
    o.name as org_name,
    o.code as org_code,
    o.is_active as org_is_active,
    u.is_active as user_is_active,
    u.password_hash,
    CASE 
        WHEN u.password_hash = 'invitation_pending' THEN 'User needs to complete signup'
        WHEN u.is_active = false THEN 'User account inactive'
        WHEN o.is_active = false THEN 'Organization inactive'
        ELSE 'Should be able to login'
    END as status_summary
FROM organization_members om
JOIN organizations o ON om.organization_uuid = o.id
JOIN users u ON om.user_auth_id = u.auth_id
WHERE u.email = 'alec.deangelo@ol-usa.com';

-- 4. Recommendation based on current status
SELECT 
    'Recommendation' as check_type,
    CASE 
        WHEN password_hash = 'invitation_pending' AND is_active = false THEN 
            'Alec should complete the SIGN-UP process with the invitation link'
        WHEN password_hash = 'supabase_managed' AND is_active = true THEN 
            'Alec can LOGIN directly at /sign-in'
        WHEN password_hash = 'supabase_managed' AND is_active = false THEN 
            'Need to activate Alec''s account first'
        ELSE 
            'Status unclear - needs investigation'
    END as recommendation,
    password_hash as current_hash_status,
    is_active as current_active_status
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';


