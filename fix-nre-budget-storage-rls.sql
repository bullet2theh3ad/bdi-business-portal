-- Fix RLS policies for NRE Budget file uploads in organization-documents bucket

-- First, check existing policies for organization-documents bucket
SELECT 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%organization%';

-- Add policy to allow BDI users to upload to nre-budgets folder
CREATE POLICY "Allow BDI users to upload NRE budget documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'organization-documents'
  AND (storage.foldername(name))[1] = 'nre-budgets'
  AND EXISTS (
    SELECT 1 FROM organization_members om
    INNER JOIN organizations o ON o.id = om.organization_uuid
    WHERE om.user_auth_id = auth.uid()
      AND o.code = 'BDI'
      AND om.role IN ('owner', 'admin', 'member')
  )
);

-- Add policy to allow BDI users to read NRE budget documents
CREATE POLICY "Allow BDI users to read NRE budget documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'organization-documents'
  AND (storage.foldername(name))[1] = 'nre-budgets'
  AND EXISTS (
    SELECT 1 FROM organization_members om
    INNER JOIN organizations o ON o.id = om.organization_uuid
    WHERE om.user_auth_id = auth.uid()
      AND o.code = 'BDI'
      AND om.role IN ('owner', 'admin', 'member')
  )
);

-- Add policy to allow BDI users to update NRE budget documents
CREATE POLICY "Allow BDI users to update NRE budget documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'organization-documents'
  AND (storage.foldername(name))[1] = 'nre-budgets'
  AND EXISTS (
    SELECT 1 FROM organization_members om
    INNER JOIN organizations o ON o.id = om.organization_uuid
    WHERE om.user_auth_id = auth.uid()
      AND o.code = 'BDI'
      AND om.role IN ('owner', 'admin', 'member')
  )
);

-- Add policy to allow BDI users to delete NRE budget documents
CREATE POLICY "Allow BDI users to delete NRE budget documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'organization-documents'
  AND (storage.foldername(name))[1] = 'nre-budgets'
  AND EXISTS (
    SELECT 1 FROM organization_members om
    INNER JOIN organizations o ON o.id = om.organization_uuid
    WHERE om.user_auth_id = auth.uid()
      AND o.code = 'BDI'
      AND om.role IN ('owner', 'admin', 'member')
  )
);
