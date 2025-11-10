-- Comprehensive diagnostic for hmitchem's account
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Check Supabase Auth (Primary Authentication)
-- ============================================================================
SELECT 
  '1. SUPABASE AUTH' as check_type,
  id as auth_id,
  email,
  email_confirmed_at,
  last_sign_in_at,
  created_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN '❌ EMAIL NOT CONFIRMED'
    WHEN last_sign_in_at IS NULL THEN '⚠️ NEVER LOGGED IN'
    ELSE '✅ AUTH OK'
  END as status
FROM auth.users
WHERE email ILIKE '%hmit%';

-- ============================================================================
-- STEP 2: Check Internal Users Table
-- ============================================================================
SELECT 
  '2. USERS TABLE' as check_type,
  id,
  auth_id,
  email,
  name,
  role,
  is_active,
  created_at,
  CASE 
    WHEN is_active = false THEN '❌ USER INACTIVE'
    WHEN role IS NULL THEN '⚠️ NO ROLE ASSIGNED'
    ELSE '✅ USER OK'
  END as status
FROM users
WHERE email ILIKE '%hmit%';

-- ============================================================================
-- STEP 3: Check Organization Membership
-- ============================================================================
SELECT 
  '3. ORGANIZATION' as check_type,
  om.user_auth_id,
  o.name as organization_name,
  o.code as org_code,
  om.role as member_role,
  CASE 
    WHEN o.code = 'BDI' THEN '✅ IN BDI ORG'
    ELSE '⚠️ NOT IN BDI'
  END as status
FROM organization_members om
JOIN organizations o ON om.organization_uuid = o.id
JOIN users u ON om.user_auth_id = u.auth_id
WHERE u.email ILIKE '%hmit%';

-- ============================================================================
-- STEP 4: Check if Email is in Correct Format
-- ============================================================================
SELECT 
  '4. EMAIL CHECK' as check_type,
  email,
  CASE 
    WHEN email = 'hmitchem@boundlessdevices.com' THEN '✅ CORRECT SPELLING'
    WHEN email = 'hmitcehm@boundlessdevices.com' THEN '✅ ALT SPELLING (covered)'
    ELSE '❌ WRONG SPELLING: ' || email
  END as status
FROM auth.users
WHERE email ILIKE '%hmit%';

-- ============================================================================
-- STEP 5: Summary - All Checks
-- ============================================================================
SELECT 
  '5. SUMMARY' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM auth.users 
      WHERE email ILIKE '%hmit%' 
      AND email_confirmed_at IS NOT NULL
    ) THEN '✅' ELSE '❌'
  END as auth_confirmed,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM users 
      WHERE email ILIKE '%hmit%' 
      AND is_active = true
    ) THEN '✅' ELSE '❌'
  END as user_active,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM users u
      JOIN organization_members om ON u.auth_id = om.user_auth_id
      JOIN organizations o ON om.organization_uuid = o.id
      WHERE u.email ILIKE '%hmit%'
      AND o.code = 'BDI'
    ) THEN '✅' ELSE '❌'
  END as in_bdi_org,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM auth.users 
      WHERE email IN ('hmitchem@boundlessdevices.com', 'hmitcehm@boundlessdevices.com')
    ) THEN '✅' ELSE '❌'
  END as email_in_whitelist;

-- ============================================================================
-- TROUBLESHOOTING GUIDE
-- ============================================================================
-- If auth_confirmed = ❌: She needs to confirm her email or reset password
-- If user_active = ❌: Run Step 6A to activate her
-- If in_bdi_org = ❌: Run Step 6B to add her to BDI
-- If email_in_whitelist = ❌: Check exact email spelling and update whitelist

-- ============================================================================
-- STEP 6A: FIX - Activate User (if needed)
-- ============================================================================
-- Uncomment and run if user_active = ❌
/*
UPDATE users
SET is_active = true
WHERE email ILIKE '%hmit%';
*/

-- ============================================================================
-- STEP 6B: FIX - Add to BDI Organization (if needed)
-- ============================================================================
-- First, get her auth_id and BDI org id:
/*
SELECT 
  u.auth_id,
  (SELECT id FROM organizations WHERE code = 'BDI') as bdi_org_id
FROM users u
WHERE u.email ILIKE '%hmit%';

-- Then insert into organization_members (replace UUIDs with actual values):
INSERT INTO organization_members (user_auth_id, organization_uuid, role)
VALUES (
  '<auth_id_from_above>',
  '<bdi_org_id_from_above>',
  'member'
)
ON CONFLICT DO NOTHING;
*/

-- ============================================================================
-- STEP 7: Verify Whitelist Access
-- ============================================================================
-- The whitelist in code currently includes:
-- - hmitchem@boundlessdevices.com
-- - hmitcehm@boundlessdevices.com
-- 
-- If her email in the database is different, either:
-- A) Update her email in database to match whitelist
-- B) Add her actual email to the whitelist in code

-- ============================================================================
-- STEP 8: Test Access
-- ============================================================================
-- After fixes, have her:
-- 1. Log out completely
-- 2. Log back in
-- 3. Navigate to: Admin → Inventory Analysis → GL Code Assignment
-- 4. Check browser console (F12) for any errors
-- 5. Check server logs for: [GL Summary] Access granted/denied

