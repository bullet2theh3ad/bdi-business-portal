-- Sync login times from Supabase Auth to database for all users
UPDATE users 
SET 
    last_login_at = au.last_sign_in_at,
    updated_at = NOW()
FROM auth.users au 
WHERE users.auth_id::uuid = au.id 
  AND au.last_sign_in_at IS NOT NULL;
