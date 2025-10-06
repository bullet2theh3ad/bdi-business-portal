-- Complete Alec's Sign-up Process Manually
-- This bypasses the broken sign-up action and activates his account

BEGIN;

-- 1. Update Alec's user record to complete the sign-up
UPDATE users 
SET 
    password_hash = 'supabase_managed',  -- Change from 'invitation_pending' to managed by Supabase
    is_active = true,                    -- Activate the account
    updated_at = NOW(),                  -- Update timestamp
    reset_token = NULL,                  -- Clear any reset token
    reset_token_expiry = NULL            -- Clear token expiry
WHERE email = 'alec.deangelo@ol-usa.com'
  AND password_hash = 'invitation_pending'
  AND is_active = false;

-- 2. Verify the update worked
SELECT 
    'Alec Updated Status' as check_type,
    id,
    auth_id,
    name,
    email,
    role,
    password_hash,
    is_active,
    updated_at
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

-- 3. Verify organization membership is still intact
SELECT 
    'Alec Membership Verification' as check_type,
    om.role as membership_role,
    om.joined_at,
    o.name as org_name,
    o.code as org_code,
    o.is_active as org_is_active,
    u.is_active as user_is_active,
    u.password_hash
FROM organization_members om
JOIN organizations o ON om.organization_uuid = o.id
JOIN users u ON om.user_auth_id = u.auth_id
WHERE u.email = 'alec.deangelo@ol-usa.com';

-- 4. Show final status
SELECT 
    'Final Status' as check_type,
    CASE 
        WHEN password_hash = 'supabase_managed' AND is_active = true THEN 
            'SUCCESS - Alec can now login at /sign-in'
        ELSE 
            'FAILED - Still needs manual intervention'
    END as status,
    email,
    password_hash,
    is_active
FROM users 
WHERE email = 'alec.deangelo@ol-usa.com';

COMMIT;














