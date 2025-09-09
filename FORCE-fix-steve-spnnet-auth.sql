-- FORCE FIX: steve@spnnet.com auth ID by temporarily removing foreign key constraint
-- This is the only way to update both tables when they reference each other

-- STEP 1: Drop the foreign key constraint temporarily
ALTER TABLE organization_members 
DROP CONSTRAINT IF EXISTS organization_members_user_auth_id_fkey;

-- STEP 2: Update users table
UPDATE users 
SET auth_id = '89868a09-c648-4ee7-8c23-9eba6dce7c00'
WHERE email = 'steve@spnnet.com' 
  AND auth_id = 'bf311240-0d74-429e-8292-c82b3bc06c26';

-- STEP 3: Update organization_members table  
UPDATE organization_members 
SET user_auth_id = '89868a09-c648-4ee7-8c23-9eba6dce7c00'
WHERE user_auth_id = 'bf311240-0d74-429e-8292-c82b3bc06c26';

-- STEP 4: Recreate the foreign key constraint
ALTER TABLE organization_members 
ADD CONSTRAINT organization_members_user_auth_id_fkey 
FOREIGN KEY (user_auth_id) REFERENCES users(auth_id);

-- STEP 5: Verify the fix worked
SELECT 
    'FORCE FIX VERIFICATION' as status,
    email,
    auth_id,
    role,
    supplier_code,
    is_active
FROM users 
WHERE email = 'steve@spnnet.com';

-- STEP 6: Verify organization membership is correct
SELECT 
    'MEMBERSHIP VERIFICATION' as status,
    u.email,
    u.auth_id,
    om.user_auth_id,
    om.role as org_role,
    o.code as org_code,
    CASE 
        WHEN u.auth_id = om.user_auth_id THEN 'SYNCED ✅'
        ELSE 'MISMATCH ❌'
    END as auth_status
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'steve@spnnet.com';

-- STEP 7: Test what API lookup will find
SELECT 
    'API LOOKUP TEST' as status,
    'Auth ID: 89868a09-c648-4ee7-8c23-9eba6dce7c00' as lookup_id,
    email,
    role,
    supplier_code,
    'Should now work!' as note
FROM users 
WHERE auth_id = '89868a09-c648-4ee7-8c23-9eba6dce7c00';

-- CRITICAL: After running this SQL:
-- 1. steve@spnnet.com MUST log out completely
-- 2. Clear browser cache/cookies  
-- 3. Log back in with fresh session
-- 4. Should see ALL MTN pages like steve@cistulli.com
