-- Check MTN organization users and their roles/membership levels
-- Shows user details, roles, and membership status in MTN organization

SELECT 
  u.id as user_id,
  u.auth_id,
  u.name,
  u.email,
  u.role as system_role,
  u.title,
  u.department,
  u.is_active as user_active,
  u.last_login_at,
  u.created_at as user_created,
  
  -- Organization membership details
  om.role as membership_role,
  om.joined_at as membership_joined,
  om.is_active as membership_active,
  
  -- Organization details
  o.name as organization_name,
  o.code as org_code,
  o.type as org_type,
  o.is_active as org_active

FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id

WHERE o.code = 'MTN'
  OR o.name ILIKE '%MTN%'
  OR o.name ILIKE '%Mountain%'

ORDER BY 
  om.role DESC,             -- Show owners/admins first
  u.role DESC,              -- Then by system role
  u.name ASC;               -- Then alphabetically

-- Additional query: Count MTN users by role
SELECT 
  'MTN User Summary' as summary_type,
  COUNT(*) as total_mtn_users,
  COUNT(CASE WHEN u.role = 'super_admin' THEN 1 END) as super_admins,
  COUNT(CASE WHEN u.role = 'admin' THEN 1 END) as admins,
  COUNT(CASE WHEN u.role = 'user' THEN 1 END) as regular_users,
  COUNT(CASE WHEN u.role = 'developer' THEN 1 END) as developers,
  COUNT(CASE WHEN om.role = 'owner' THEN 1 END) as org_owners,
  COUNT(CASE WHEN om.role = 'admin' THEN 1 END) as org_admins,
  COUNT(CASE WHEN om.role = 'member' THEN 1 END) as org_members,
  COUNT(CASE WHEN u.is_active = true THEN 1 END) as active_users,
  COUNT(CASE WHEN om.is_active = true THEN 1 END) as active_memberships

FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id

WHERE o.code = 'MTN'
  OR o.name ILIKE '%MTN%'
  OR o.name ILIKE '%Mountain%';
