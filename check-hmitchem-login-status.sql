-- Check if Hannah has logged in and accepted her invitation
SELECT 
    id,
    auth_id,
    name,
    email,
    role,
    is_active,
    last_login_at,
    created_at,
    updated_at
FROM users 
WHERE email = 'hmitchem@boundlessdevices.com';
