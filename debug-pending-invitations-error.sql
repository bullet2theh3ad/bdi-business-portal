-- Debug pending invitations API error
-- Check if our recent schema changes affected the user/organization lookup

-- Check if users table is accessible
SELECT COUNT(*) as user_count FROM users;

-- Check if organization_members table is accessible  
SELECT COUNT(*) as member_count FROM organization_members;

-- Check if organizations table is accessible
SELECT COUNT(*) as org_count FROM organizations;

-- Check if there are any issues with the user lookup for Steven
SELECT 
    u.id,
    u.auth_id,
    u.email,
    u.role,
    u.is_active,
    om.organization_uuid,
    o.code as org_code,
    o.name as org_name
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'scistulli@boundlessdevices.com';

-- Check if there are any pending invitations at all
SELECT COUNT(*) as pending_count 
FROM users 
WHERE is_active = false 
AND password_hash = 'invitation_pending' 
AND deleted_at IS NULL;

-- Check recent organizations (last 30 days)
SELECT id, name, code, created_at 
FROM organizations 
WHERE created_at >= NOW() - INTERVAL '30 days'
AND code != 'BDI'
ORDER BY created_at DESC;

-- Check if policy_documents table was created successfully
SELECT COUNT(*) as policy_docs_count FROM policy_documents;

-- Check if our new table has RLS policies that might be blocking access
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('policy_documents', 'users', 'organizations', 'organization_members')
ORDER BY tablename, policyname;
