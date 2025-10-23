-- Check current user details for jeskelson
SELECT 
  id,
  name,
  email,
  role,
  is_active
FROM users
WHERE email = 'jeskelson@boundlessdevices.com';

-- If super_admin but no access, ensure account is active
UPDATE users
SET 
  is_active = true,
  updated_at = NOW()
WHERE email = 'jeskelson@boundlessdevices.com';

-- Verify the update
SELECT 
  id,
  name,
  email,
  role,
  is_active,
  updated_at
FROM users
WHERE email = 'jeskelson@boundlessdevices.com';

