-- Check if Alec has organization membership with OLM
-- The token has the correct organization ID, so membership should exist

-- 1. Check if Alec has membership with the OLM organization
SELECT 
    'Alec OLM Membership Status' as check_type,
    om.id as membership_id,
    om.user_auth_id,
    om.organization_uuid,
    om.role as membership_role,
    om.joined_at,
    u.auth_id as user_auth_id,
    u.email,
    u.name,
    u.role as user_role,
    u.is_active as user_active,
    u.password_hash,
    o.name as org_name,
    o.code as org_code,
    o.is_active as org_active
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'alec.deangelo@ol-usa.com'
  AND o.id = '870fc2eb-27e7-42b5-a476-815fdff2fa7c';

-- 2. Check if Alec's auth_id exists in organization_members at all
SELECT 
    'Alec Any Memberships' as check_type,
    om.id,
    om.user_auth_id,
    om.organization_uuid,
    om.role,
    om.joined_at,
    o.name as org_name,
    o.code as org_code
FROM organization_members om
JOIN organizations o ON om.organization_uuid = o.id
WHERE om.user_auth_id = '88bd7449-56bd-4f28-a348-3ea5d8d06589';

