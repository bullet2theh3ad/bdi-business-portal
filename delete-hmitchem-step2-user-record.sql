-- Step 2: Remove Hannah's user record from the database
DELETE FROM users 
WHERE auth_id = '17e44952-1809-49f9-846c-da94a5a25835';
