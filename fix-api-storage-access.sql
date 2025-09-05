-- Fix Supabase Storage Access for API Downloads
-- This allows the service role to access files for API downloads
-- Run this in your Supabase SQL Editor

-- 1. Add a policy to allow service role to read files from organization-documents bucket
-- This is needed for API downloads since API users don't have Supabase Auth sessions
CREATE POLICY "Service role can read organization documents"
ON storage.objects
FOR SELECT
USING (
  auth.role() = 'service_role' AND
  bucket_id = 'organization-documents'
);

-- 2. Also allow service role to read production files specifically
-- This ensures production files can be downloaded via API
CREATE POLICY "Service role can read production files"
ON storage.objects
FOR SELECT
USING (
  auth.role() = 'service_role' AND
  bucket_id = 'organization-documents' AND
  name LIKE 'production-files/%'
);

-- 3. Optional: Allow service role to manage files (upload, delete, update)
-- This might be needed for API file management operations
CREATE POLICY "Service role can manage organization documents"
ON storage.objects
FOR ALL
USING (
  auth.role() = 'service_role' AND
  bucket_id = 'organization-documents'
)
WITH CHECK (
  auth.role() = 'service_role' AND
  bucket_id = 'organization-documents'
);

-- 4. Check that the policies were created successfully
SELECT 
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%service_role%'
ORDER BY policyname;
