-- Elevate hmitchem@boundlessdevices.com to super_admin
-- Elevate kdrennan@boundlessdevices.com to admin_cfo

-- First, check current status
SELECT 
  id,
  name,
  email,
  role,
  is_active
FROM users
WHERE email IN ('hmitchem@boundlessdevices.com', 'kdrennan@boundlessdevices.com')
ORDER BY email;

-- Elevate hmitchem to super_admin
UPDATE users
SET 
  role = 'super_admin',
  updated_at = NOW()
WHERE email = 'hmitchem@boundlessdevices.com'
  AND is_active = true;

-- Elevate kdrennan to admin_cfo
UPDATE users
SET 
  role = 'admin_cfo',
  updated_at = NOW()
WHERE email = 'kdrennan@boundlessdevices.com'
  AND is_active = true;

-- Verify the changes
SELECT 
  id,
  name,
  email,
  role,
  is_active,
  updated_at
FROM users
WHERE email IN ('hmitchem@boundlessdevices.com', 'kdrennan@boundlessdevices.com')
ORDER BY email;
