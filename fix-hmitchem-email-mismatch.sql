-- Fix Hannah's email mismatch between database and auth
-- Update her database email to match her Supabase auth email
UPDATE users 
SET 
    email = 'hannahjomitchem@gmail.com',
    updated_at = NOW()
WHERE auth_id = '17e44952-1809-49f9-846c-da94a5a25835';
