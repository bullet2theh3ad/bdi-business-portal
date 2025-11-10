-- ==========================================
-- COMPARE USER PROFILES: scistulli vs hmitchem
-- ==========================================
-- Run each query separately to see side-by-side comparison

-- ===== 1. AUTH.USERS COMPARISON =====
SELECT 
  '1. AUTH.USERS' as section,
  email,
  id as auth_user_id,
  email_confirmed_at IS NOT NULL as email_confirmed,
  phone_confirmed_at IS NOT NULL as phone_confirmed,
  confirmed_at IS NOT NULL as confirmed,
  last_sign_in_at,
  created_at as auth_created_at,
  updated_at as auth_updated_at,
  role,
  aud,
  is_sso_user,
  deleted_at IS NOT NULL as is_deleted
FROM auth.users
WHERE email IN ('scistulli@boundlessdevices.com', 'hmitchem@boundlessdevices.com')
ORDER BY email;

-- ===== 2. USERS TABLE COMPARISON =====
SELECT 
  '2. USERS TABLE' as section,
  u.email,
  u.id as internal_user_id,
  u.role as user_role,
  u.is_active,
  u.organization_id,
  u.auth_user_id,
  u.created_at as user_created_at,
  u.updated_at as user_updated_at
FROM users u
WHERE u.email IN ('scistulli@boundlessdevices.com', 'hmitchem@boundlessdevices.com')
ORDER BY u.email;

-- ===== 3. ORGANIZATION MEMBERSHIP COMPARISON =====
SELECT 
  '3. ORG MEMBERSHIP' as section,
  u.email,
  om.user_id,
  om.organization_id,
  om.role as org_role,
  o.name as org_name,
  o.code as org_code,
  o.is_active as org_is_active
FROM users u
LEFT JOIN organization_members om ON om.user_id = u.id
LEFT JOIN organizations o ON o.id = om.organization_id
WHERE u.email IN ('scistulli@boundlessdevices.com', 'hmitchem@boundlessdevices.com')
ORDER BY u.email;

-- ===== 4. QUICKBOOKS WHITELIST CHECK =====
SELECT 
  '4. WHITELIST CHECK' as section,
  'scistulli@boundlessdevices.com' as email,
  CASE 
    WHEN 'scistulli@boundlessdevices.com' IN (
      'scistulli@boundlessdevices.com',
      'dzand@boundlessdevices.com',
      'sjin@boundlessdevices.com',
      'hmitchem@boundlessdevices.com',
      'hmitcehm@boundlessdevices.com'
    ) THEN '✅ WHITELISTED'
    ELSE '❌ NOT WHITELISTED'
  END as whitelist_status
UNION ALL
SELECT 
  '4. WHITELIST CHECK' as section,
  'hmitchem@boundlessdevices.com' as email,
  CASE 
    WHEN 'hmitchem@boundlessdevices.com' IN (
      'scistulli@boundlessdevices.com',
      'dzand@boundlessdevices.com',
      'sjin@boundlessdevices.com',
      'hmitchem@boundlessdevices.com',
      'hmitcehm@boundlessdevices.com'
    ) THEN '✅ WHITELISTED'
    ELSE '❌ NOT WHITELISTED'
  END as whitelist_status;

-- ===== 5. EMAIL FORMAT CHECK =====
SELECT 
  '5. EMAIL FORMAT' as section,
  email,
  length(email) as email_length,
  email = lower(email) as is_lowercase,
  email = trim(email) as no_extra_spaces,
  email LIKE '% %' as has_internal_spaces,
  encode(email::bytea, 'hex') as hex_representation
FROM auth.users
WHERE email IN ('scistulli@boundlessdevices.com', 'hmitchem@boundlessdevices.com')
ORDER BY email;

-- ===== 6. AUTH USER ID MATCH CHECK =====
SELECT 
  '6. ID MATCH' as section,
  au.email,
  au.id as auth_users_id,
  u.auth_user_id as users_auth_user_id,
  CASE 
    WHEN au.id = u.auth_user_id THEN '✅ MATCH'
    WHEN au.id IS NULL THEN '❌ NO AUTH RECORD'
    WHEN u.auth_user_id IS NULL THEN '❌ NO LINK IN USERS TABLE'
    ELSE '❌ MISMATCH'
  END as id_match_status
FROM auth.users au
LEFT JOIN users u ON u.email = au.email
WHERE au.email IN ('scistulli@boundlessdevices.com', 'hmitchem@boundlessdevices.com')
ORDER BY au.email;

-- ===== 7. PERMISSIONS SUMMARY =====
SELECT 
  '7. PERMISSIONS' as section,
  u.email,
  u.role as user_role,
  u.is_active as user_active,
  om.role as org_role,
  o.is_active as org_active,
  CASE 
    WHEN u.is_active AND o.is_active THEN '✅ ACTIVE'
    WHEN NOT u.is_active THEN '❌ USER INACTIVE'
    WHEN NOT o.is_active THEN '❌ ORG INACTIVE'
    ELSE '❓ UNKNOWN'
  END as access_status
FROM users u
LEFT JOIN organization_members om ON om.user_id = u.id
LEFT JOIN organizations o ON o.id = om.organization_id
WHERE u.email IN ('scistulli@boundlessdevices.com', 'hmitchem@boundlessdevices.com')
ORDER BY u.email;

-- INSTRUCTIONS:
-- If both users show identical results in all queries above, the DB is NOT the issue.
-- Look for differences in:
-- - auth_user_id mismatch
-- - is_active = false
-- - email format differences (spaces, case)
-- - Missing organization_members record

