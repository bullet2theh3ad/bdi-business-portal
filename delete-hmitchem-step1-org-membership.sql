-- Step 1: Remove Hannah's organization membership first (due to foreign key constraints)
DELETE FROM organization_members 
WHERE user_auth_id = '17e44952-1809-49f9-846c-da94a5a25835';
