-- Check hmitchem@boundlessdevices.com basic user record
SELECT 
    id,
    auth_id,
    name,
    email,
    role,
    is_active,
    last_login_at,
    created_at,
    reset_token,
    reset_token_expiry
FROM users 
WHERE email = 'hmitchem@boundlessdevices.com';
