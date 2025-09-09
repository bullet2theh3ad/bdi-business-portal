-- Immediate fix for steve@spnnet.com to have same access as steve@cistulli.com
-- This user needs to log out and back in after running this SQL

-- Update steve@spnnet.com to have supplier_code like steve@cistulli.com
UPDATE users 
SET supplier_code = 'MTN'
WHERE email = 'steve@spnnet.com';

-- Also update Enya for consistency
UPDATE users 
SET supplier_code = 'MTN'
WHERE email = 'sales3@mtncn.com';

-- Verify the fix
SELECT 
    'IMMEDIATE FIX VERIFICATION' as status,
    email,
    name,
    role as system_role,
    supplier_code,
    is_active
FROM users 
WHERE email IN ('steve@cistulli.com', 'steve@spnnet.com', 'sales3@mtncn.com')
ORDER BY email;

-- Double-check MTN enabled_pages (should be set from previous fix)
SELECT 
    'MTN ENABLED PAGES CHECK' as status,
    code,
    enabled_pages
FROM organizations 
WHERE code = 'MTN';
