-- Fix steve@spnnet.com auth ID mismatch - proper order to avoid foreign key constraint
-- Current Supabase auth ID: 89868a09-c648-4ee7-8c23-9eba6dce7c00
-- Current Database auth ID: bf311240-0d74-429e-8292-c82b3bc06c26

-- STEP 1: Update organization_members table FIRST (to avoid foreign key constraint)
UPDATE organization_members 
SET user_auth_id = '89868a09-c648-4ee7-8c23-9eba6dce7c00'
WHERE user_auth_id = 'bf311240-0d74-429e-8292-c82b3bc06c26';

-- STEP 2: Now update users table
UPDATE users 
SET auth_id = '89868a09-c648-4ee7-8c23-9eba6dce7c00'
WHERE email = 'steve@spnnet.com';

-- STEP 3: Verify the fix worked
SELECT 
    'AUTH FIX VERIFICATION' as status,
    id,
    auth_id,
    email,
    name,
    role,
    supplier_code,
    is_active
FROM users 
WHERE email = 'steve@spnnet.com';

-- STEP 4: Verify organization membership is correct
SELECT 
    'MEMBERSHIP VERIFICATION' as status,
    u.email,
    u.auth_id as user_auth_id,
    om.user_auth_id as membership_auth_id,
    om.role as org_role,
    o.code as org_code,
    CASE 
        WHEN u.auth_id = om.user_auth_id THEN 'MATCH ✅'
        ELSE 'MISMATCH ❌'
    END as auth_id_status
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'steve@spnnet.com';

-- STEP 5: Check what the /api/user endpoint will now return
SELECT 
    'EXPECTED API RESPONSE' as status,
    'steve@spnnet.com should now work with auth_id: 89868a09-c648-4ee7-8c23-9eba6dce7c00' as note;
