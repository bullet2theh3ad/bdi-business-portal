-- Check your current user session details (fixed UUID casting)
SELECT 
    u.name,
    u.email,
    u.last_login_at as db_last_login,
    u.created_at as db_created,
    u.updated_at as db_updated,
    au.last_sign_in_at as auth_last_signin,
    au.created_at as auth_created,
    au.updated_at as auth_updated
FROM users u
JOIN auth.users au ON u.auth_id::uuid = au.id
WHERE u.email = 'scistulli@boundlessdevices.com';
