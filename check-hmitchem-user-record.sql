-- Check hmitchem@boundlessdevices.com user record for password reset
-- This will show her current user data and auth status

-- 1. Check user record in the users table
SELECT 
    id,
    auth_id,
    name,
    email,
    role,
    is_active,
    last_login_at,
    created_at,
    updated_at,
    reset_token,
    reset_token_expiry,
    invitation_delivery_status,
    invitation_bounce_reason
FROM users 
WHERE email = 'hmitchem@boundlessdevices.com';

-- 2. Check organization membership
SELECT 
    om.role as membership_role,
    o.name as organization_name,
    o.code as organization_code,
    o.type as organization_type
FROM organization_members om
JOIN organizations o ON om.organization_uuid = o.id
JOIN users u ON om.user_auth_id = u.auth_id
WHERE u.email = 'hmitchem@boundlessdevices.com';

-- 3. Check if there's a corresponding Supabase auth record
-- Note: This query might not work depending on your RLS policies
-- You may need to check this in the Supabase dashboard under Authentication > Users
SELECT 
    'Check Supabase Auth Dashboard for auth record' as note,
    'Look for user with email: hmitchem@boundlessdevices.com' as instruction;
