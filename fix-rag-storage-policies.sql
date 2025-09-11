-- Fix RAG storage policies - drop and recreate properly
-- Run this in Supabase SQL Editor

-- 1. Drop existing RAG policies if they exist
DROP POLICY IF EXISTS "Super admins can upload to RAG documents folder" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can view RAG documents" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can delete RAG documents" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can update RAG documents" ON storage.objects;

-- 2. Create comprehensive RAG document policies
-- Upload policy for RAG documents
CREATE POLICY "Super admins can upload to RAG documents folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  bucket_id = 'organization-documents' AND
  (storage.foldername(name))[1] = 'rag-documents' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE auth_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- View policy for RAG documents
CREATE POLICY "Super admins can view RAG documents"
ON storage.objects
FOR SELECT
USING (
  auth.role() = 'authenticated' AND
  bucket_id = 'organization-documents' AND
  (storage.foldername(name))[1] = 'rag-documents' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE auth_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Delete policy for RAG documents
CREATE POLICY "Super admins can delete RAG documents"
ON storage.objects
FOR DELETE
USING (
  auth.role() = 'authenticated' AND
  bucket_id = 'organization-documents' AND
  (storage.foldername(name))[1] = 'rag-documents' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE auth_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Update policy for RAG documents
CREATE POLICY "Super admins can update RAG documents"
ON storage.objects
FOR UPDATE
USING (
  auth.role() = 'authenticated' AND
  bucket_id = 'organization-documents' AND
  (storage.foldername(name))[1] = 'rag-documents' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE auth_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- 3. Verify the policies were created
SELECT 
    policyname, 
    cmd,
    with_check,
    qual
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%RAG%'
ORDER BY policyname;
