-- Create special RLS policy for RAG document uploads
-- This allows super_admin users to upload to rag-documents folder structure

-- Create policy for RAG documents folder
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

-- Allow super admins to view RAG documents
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

-- Allow super admins to delete RAG documents
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

-- Allow super admins to update RAG documents
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
