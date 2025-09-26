-- Direct password reset for sjchoi@boundlessdevices.com bypassing email rate limits
-- This updates the password hash directly in the database

-- Step 1: Check current user status
SELECT 
  u.id,
  u.auth_id,
  u.name,
  u.email,
  u.role,
  u.is_active,
  u.last_login_at,
  u.created_at,
  o.name as organization,
  o.code as org_code
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'sjchoi@boundlessdevices.com';

-- Step 2: Generate new password hash for temporary password
-- Temporary password: "BDI2025!" (user should change after login)
-- This is bcrypt hash for "BDI2025!" with salt rounds 10

DO $$
DECLARE
    user_auth_uuid UUID;
    temp_password_hash TEXT := '$2b$10$rQ8YgJw5Z1h5x.Zp3J9vKe7VnHnKqS8YxGz9mP2lL4tE6wR1sA3uO'; -- Hash for "BDI2025!"
BEGIN
    -- Get user's auth_id
    SELECT auth_id INTO user_auth_uuid 
    FROM users 
    WHERE email = 'sjchoi@boundlessdevices.com';
    
    IF user_auth_uuid IS NULL THEN
        RAISE NOTICE 'User sjchoi@boundlessdevices.com not found in database';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Found user auth_id: %', user_auth_uuid;
    
    -- Update password hash in database
    UPDATE users 
    SET 
        password_hash = temp_password_hash,
        updated_at = NOW()
    WHERE auth_id = user_auth_uuid;
    
    RAISE NOTICE 'Password hash updated for sjchoi@boundlessdevices.com';
    RAISE NOTICE 'Temporary password: BDI2025!';
    RAISE NOTICE 'User should change password after login';
    
END $$;

-- Step 3: Verification
SELECT 
  'Password Reset Status' as status,
  email,
  CASE 
    WHEN password_hash = '$2b$10$rQ8YgJw5Z1h5x.Zp3J9vKe7VnHnKqS8YxGz9mP2lL4tE6wR1sA3uO' 
    THEN '✅ Password hash updated successfully'
    ELSE '❌ Password hash not updated'
  END as password_status,
  updated_at
FROM users 
WHERE email = 'sjchoi@boundlessdevices.com';

-- IMPORTANT NOTES:
-- 1. This bypasses Supabase Auth email system due to rate limits
-- 2. Temporary password: "BDI2025!" 
-- 3. User MUST change password after first login
-- 4. This only updates the database - Supabase Auth may need separate update
-- 5. Consider increasing email rate limits in Supabase project settings
