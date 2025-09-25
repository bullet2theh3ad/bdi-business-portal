-- Show individual MTN users with their specific admin/member status
-- Simple view of each MTN user and their role levels

SELECT 
  u.name,
  u.email,
  u.title,
  u.role as system_role,        -- super_admin, admin, user, developer
  om.role as org_role,          -- owner, admin, member
  u.is_active as active,
  u.last_login_at,
  u.created_at as joined_date

FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id

WHERE o.code = 'MTN'

ORDER BY 
  om.role DESC,    -- Show org owners/admins first
  u.name ASC;      -- Then alphabetically

-- Show just the key info
SELECT 
  '=== MTN USERS SUMMARY ===' as info;

SELECT 
  u.name as "Name",
  u.email as "Email", 
  u.role as "System Role",
  om.role as "Org Role",
  CASE WHEN u.is_active THEN '✅ Active' ELSE '❌ Inactive' END as "Status",
  u.title as "Title"

FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id  
JOIN organizations o ON om.organization_uuid = o.id

WHERE o.code = 'MTN'

ORDER BY om.role DESC, u.name ASC;
