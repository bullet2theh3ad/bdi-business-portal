-- STEP 1: Show both users from auth.users
SELECT *
FROM auth.users
WHERE email IN ('scistulli@boundlessdevices.com', 'hmitchem@boundlessdevices.com')
ORDER BY email;

-- STEP 2: Show both users from users table
SELECT *
FROM users
WHERE email IN ('scistulli@boundlessdevices.com', 'hmitchem@boundlessdevices.com')
ORDER BY email;

-- STEP 3: Show organization_members table structure first
SELECT *
FROM organization_members
LIMIT 1;

-- STEP 4: Show all orgs
SELECT *
FROM organizations
LIMIT 5;
