-- Elevate Hannah Mitchem to super_admin role
UPDATE users 
SET 
    role = 'super_admin',
    updated_at = NOW()
WHERE email = 'hmitchem@boundlessdevices.com';
