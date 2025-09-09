-- URGENT: Fix steve@spnnet.com auth ID mismatch NOW
-- This is blocking ALL page access due to auth lookup failures

-- Current situation:
-- Supabase session: 89868a09-c648-4ee7-8c23-9eba6dce7c00
-- Database record: bf311240-0d74-429e-8292-c82b3bc06c26

-- STEP 1: Update organization_members table FIRST (avoid foreign key constraint)
UPDATE organization_members 
SET user_auth_id = '89868a09-c648-4ee7-8c23-9eba6dce7c00'
WHERE user_auth_id = 'bf311240-0d74-429e-8292-c82b3bc06c26';

-- STEP 2: Update users table to match session
UPDATE users 
SET auth_id = '89868a09-c648-4ee7-8c23-9eba6dce7c00'
WHERE email = 'steve@spnnet.com';

-- STEP 3: Verify the fix
SELECT 
    'URGENT FIX VERIFICATION' as status,
    email,
    auth_id,
    role,
    supplier_code,
    is_active
FROM users 
WHERE email = 'steve@spnnet.com';

-- STEP 4: Verify organization membership
SELECT 
    'MEMBERSHIP VERIFICATION' as status,
    u.email,
    u.auth_id,
    om.user_auth_id,
    om.role as org_role,
    o.code as org_code,
    CASE 
        WHEN u.auth_id = om.user_auth_id THEN 'FIXED ✅'
        ELSE 'STILL BROKEN ❌'
    END as status
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'steve@spnnet.com';

-- After running this SQL:
-- 1. steve@spnnet.com MUST log out completely
-- 2. steve@spnnet.com MUST log back in 
-- 3. Should then see all MTN pages
