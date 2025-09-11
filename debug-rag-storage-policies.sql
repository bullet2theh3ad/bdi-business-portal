-- Debug RAG storage policies and permissions
-- Run this to check what's blocking the upload

-- 1. Check existing storage policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
ORDER BY policyname;

-- 2. Check if user has super_admin role
SELECT 
    u.auth_id,
    u.name,
    u.email,
    u.role,
    om.organization_uuid,
    o.code as org_code
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'scistulli@boundlessdevices.com';

-- 3. Test the specific policy condition
SELECT 
    auth.uid() as current_auth_id,
    EXISTS (
        SELECT 1 FROM users 
        WHERE auth_id = auth.uid() 
        AND role = 'super_admin'
    ) as is_super_admin;

-- 4. Check bucket permissions
SELECT * FROM storage.buckets WHERE name = 'organization-documents';

-- 5. Check if we can manually test the folder path parsing
SELECT 
    'rag-documents/BDI/test-file.pdf' as test_path,
    (storage.foldername('rag-documents/BDI/test-file.pdf'))[1] as first_folder_part;
