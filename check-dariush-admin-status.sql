-- Check if dzand@boundlessdevices.com is super_admin
SELECT 
  id,
  auth_id,
  name,
  email,
  role,
  title,
  department,
  is_active,
  created_at,
  updated_at
FROM users 
WHERE email = 'dzand@boundlessdevices.com';

-- Also check if the user exists in auth
SELECT 
  u.email,
  u.name,
  u.role,
  u.title,
  u.is_active,
  CASE 
    WHEN u.role = 'super_admin' THEN '✅ SUPER ADMIN ACCESS'
    WHEN u.role = 'admin' THEN '⚠️ ADMIN ACCESS (not super_admin)'
    ELSE '❌ LIMITED ACCESS'
  END as access_level
FROM users u
WHERE u.email = 'dzand@boundlessdevices.com';

-- Show all super_admin users for comparison
SELECT 
  email,
  name,
  title,
  role,
  is_active,
  created_at
FROM users 
WHERE role = 'super_admin' 
ORDER BY created_at;
