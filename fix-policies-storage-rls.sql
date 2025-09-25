-- Fix Row Level Security policies for policies storage folder
-- This will allow BDI users to upload and access policy documents

-- Create storage policy for policies folder uploads
CREATE POLICY "BDI users can upload policies" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'organization-documents' 
  AND (storage.foldername(name))[1] = 'policies'
  AND auth.uid() IN (
    SELECT u.auth_id::uuid 
    FROM users u
    JOIN organization_members om ON u.auth_id = om.user_auth_id
    JOIN organizations o ON om.organization_uuid = o.id
    WHERE o.code = 'BDI'
  )
);

-- Create storage policy for policies folder access
CREATE POLICY "BDI users can view policies" ON storage.objects
FOR SELECT USING (
  bucket_id = 'organization-documents' 
  AND (storage.foldername(name))[1] = 'policies'
  AND auth.uid() IN (
    SELECT u.auth_id::uuid 
    FROM users u
    JOIN organization_members om ON u.auth_id = om.user_auth_id
    JOIN organizations o ON om.organization_uuid = o.id
    WHERE o.code = 'BDI'
  )
);

-- Create storage policy for policies folder deletion
CREATE POLICY "BDI users can delete policies" ON storage.objects
FOR DELETE USING (
  bucket_id = 'organization-documents' 
  AND (storage.foldername(name))[1] = 'policies'
  AND auth.uid() IN (
    SELECT u.auth_id::uuid 
    FROM users u
    JOIN organization_members om ON u.auth_id = om.user_auth_id
    JOIN organizations o ON om.organization_uuid = o.id
    WHERE o.code = 'BDI'
  )
);
