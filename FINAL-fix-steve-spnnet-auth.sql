-- FINAL FIX: Update steve@spnnet.com auth ID in correct order to avoid foreign key constraints
-- Session auth_id: 89868a09-c648-4ee7-8c23-9eba6dce7c00
-- Database auth_id: bf311240-0d74-429e-8292-c82b3bc06c26

-- STEP 1: Temporarily disable foreign key checks (if needed)
-- SET session_replication_role = replica;

-- STEP 2: Update users table FIRST
UPDATE users 
SET auth_id = '89868a09-c648-4ee7-8c23-9eba6dce7c00'
WHERE email = 'steve@spnnet.com' 
  AND auth_id = 'bf311240-0d74-429e-8292-c82b3bc06c26';

-- STEP 3: Update organization_members table to reference new auth_id
UPDATE organization_members 
SET user_auth_id = '89868a09-c648-4ee7-8c23-9eba6dce7c00'
WHERE user_auth_id = 'bf311240-0d74-429e-8292-c82b3bc06c26';

-- STEP 4: Re-enable foreign key checks (if disabled)
-- SET session_replication_role = DEFAULT;

-- STEP 5: Verify everything is synced
SELECT 
    'FINAL VERIFICATION' as status,
    u.email,
    u.auth_id as users_auth_id,
    om.user_auth_id as members_auth_id,
    u.role as system_role,
    u.supplier_code,
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

-- STEP 6: Test query that APIs use
SELECT 
    'API LOOKUP TEST' as status,
    'This simulates what /api/user does' as note,
    u.email,
    u.auth_id,
    u.role,
    u.supplier_code,
    o.code as org_code,
    o.type as org_type
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE u.auth_id = '89868a09-c648-4ee7-8c23-9eba6dce7c00';

-- After this SQL:
-- 1. steve@spnnet.com MUST log out completely (clear browser cache)
-- 2. steve@spnnet.com MUST log back in
-- 3. Should see all MTN pages like steve@cistulli.com
