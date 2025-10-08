-- Check scistulli@boundlessdevices.com login status and account details

-- Step 1: Check if user exists in Supabase auth
SELECT 
    'AUTH USER' as source,
    id as auth_id,
    email,
    email_confirmed_at,
    last_sign_in_at,
    created_at,
    deleted_at,
    banned_until,
    confirmation_sent_at
FROM auth.users
WHERE email = 'scistulli@boundlessdevices.com';

-- Step 2: Check if user exists in users table
SELECT 
    'USERS TABLE' as source,
    id,
    auth_id,
    email,
    name,
    role,
    is_active,
    created_at,
    updated_at
FROM users
WHERE email = 'scistulli@boundlessdevices.com';

-- Step 3: Check organization memberships
SELECT 
    'ORG MEMBERSHIP' as source,
    om.user_auth_id,
    om.organization_uuid,
    o.name as org_name,
    om.membership_role,
    om.joined_at,
    u.email
FROM organization_members om
JOIN organizations o ON om.organization_uuid = o.id
LEFT JOIN users u ON om.user_auth_id = u.auth_id
WHERE u.email = 'scistulli@boundlessdevices.com';

-- Step 4: Check for any pending invitations
SELECT 
    'PENDING INVITATION' as source,
    id,
    email,
    organization_id,
    role,
    invited_by,
    created_at,
    expires_at,
    token_hash
FROM invitations
WHERE email = 'scistulli@boundlessdevices.com'
AND expires_at > NOW();

-- Step 5: Check if there are any auth issues (locked account, etc)
SELECT 
    'AUTH DETAILS' as source,
    email,
    confirmation_token,
    recovery_token,
    email_change_token_current,
    phone_change_token,
    reauthentication_token,
    is_super_admin,
    raw_app_meta_data,
    raw_user_meta_data
FROM auth.users
WHERE email = 'scistulli@boundlessdevices.com';

