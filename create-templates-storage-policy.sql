-- Create storage policy for production file templates
-- This allows super_admin to upload templates and all users to download them

-- Create policy for template uploads (super_admin only)
CREATE POLICY "Super admin can upload templates" ON storage.objects
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'organization-documents' 
    AND name LIKE 'templates/production-files/%'
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE auth_id = auth.uid() 
      AND role = 'super_admin' 
      AND is_active = true
    )
  );

-- Create policy for template downloads (all authenticated users)
CREATE POLICY "Users can download templates" ON storage.objects
  FOR SELECT 
  USING (
    bucket_id = 'organization-documents' 
    AND name LIKE 'templates/production-files/%'
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE auth_id = auth.uid() 
      AND is_active = true
    )
  );

-- Create policy for template management (super_admin only)
CREATE POLICY "Super admin can manage templates" ON storage.objects
  FOR ALL 
  USING (
    bucket_id = 'organization-documents' 
    AND name LIKE 'templates/production-files/%'
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE auth_id = auth.uid() 
      AND role = 'super_admin' 
      AND is_active = true
    )
  );

-- Verify policies
SELECT 
  policyname, 
  cmd, 
  qual,
  with_check 
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%template%';

-- Show the templates folder structure that should be created
-- templates/production-files/
--   ├── 1726156800000_Production Data Template R2 (Sep 12 2025).xlsx
--   └── (future template versions)

COMMENT ON POLICY "Super admin can upload templates" ON storage.objects IS 
'Allows super_admin users to upload production file templates to templates/production-files/ folder';

COMMENT ON POLICY "Users can download templates" ON storage.objects IS 
'Allows all authenticated users to download production file templates';

COMMENT ON POLICY "Super admin can manage templates" ON storage.objects IS 
'Allows super_admin users to update/delete production file templates';
