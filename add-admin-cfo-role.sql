-- ADD ADMIN_CFO ROLE: New role class below super_admin with bank access permissions

-- Update user role enum to include admin_cfo
-- Note: This may require recreating the constraint depending on database setup

-- First, check current role constraints
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'users'::regclass 
AND contype = 'c';

-- Add admin_cfo as valid role (if using check constraints)
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- ALTER TABLE users ADD CONSTRAINT users_role_check 
--   CHECK (role IN ('member', 'sales', 'admin', 'admin_cfo', 'super_admin', 'developer'));

-- For now, we'll just update existing users and the application will handle the new role
-- The role field is varchar, so it can accept the new value

-- Verify current roles in use
SELECT role, COUNT(*) as user_count
FROM users 
GROUP BY role
ORDER BY 
  CASE role
    WHEN 'super_admin' THEN 1
    WHEN 'admin_cfo' THEN 2  
    WHEN 'admin' THEN 3
    WHEN 'sales' THEN 4
    WHEN 'member' THEN 5
    WHEN 'developer' THEN 6
    ELSE 7
  END;

-- Show all admin-level users for review
SELECT 
  id,
  name,
  email,
  role,
  title,
  department,
  is_active,
  created_at
FROM users 
WHERE role IN ('super_admin', 'admin', 'admin_cfo')
ORDER BY 
  CASE role
    WHEN 'super_admin' THEN 1
    WHEN 'admin_cfo' THEN 2  
    WHEN 'admin' THEN 3
    ELSE 4
  END,
  name;
