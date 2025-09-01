-- Fix Supabase Storage Setup for Invoice File Management
-- Run this in your Supabase SQL Editor

-- 1. Create the organization-documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-documents',
  'organization-documents',
  false, -- Private bucket (requires authentication)
  52428800, -- 50MB limit per file
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'text/csv'
  ]
) ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Users can upload to their organization folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their organization files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete organization files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update organization files" ON storage.objects;

-- 3. Create RLS policies for the documents bucket
-- Allow authenticated users to upload files to their organization folder
CREATE POLICY "Users can upload to their organization folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  bucket_id = 'organization-documents' AND
  (storage.foldername(name))[1] = (
    SELECT om.organization_uuid::text 
    FROM organization_members om 
    JOIN users u ON om.user_auth_id = u.auth_id 
    WHERE u.auth_id = auth.uid()
    LIMIT 1
  )
);

-- Allow users to view files from their organization
CREATE POLICY "Users can view their organization files"
ON storage.objects
FOR SELECT
USING (
  auth.role() = 'authenticated' AND
  bucket_id = 'organization-documents' AND
  (storage.foldername(name))[1] = (
    SELECT om.organization_uuid::text 
    FROM organization_members om 
    JOIN users u ON om.user_auth_id = u.auth_id 
    WHERE u.auth_id = auth.uid()
    LIMIT 1
  )
);

-- Allow users to delete files from their organization (admin/super_admin only)
CREATE POLICY "Admins can delete organization files"
ON storage.objects
FOR DELETE
USING (
  auth.role() = 'authenticated' AND
  bucket_id = 'organization-documents' AND
  (storage.foldername(name))[1] = (
    SELECT om.organization_uuid::text 
    FROM organization_members om 
    JOIN users u ON om.user_auth_id = u.auth_id 
    WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'super_admin')
    LIMIT 1
  )
);

-- Allow users to update files from their organization (admin/super_admin only)
CREATE POLICY "Admins can update organization files"
ON storage.objects
FOR UPDATE
USING (
  auth.role() = 'authenticated' AND
  bucket_id = 'organization-documents' AND
  (storage.foldername(name))[1] = (
    SELECT om.organization_uuid::text 
    FROM organization_members om 
    JOIN users u ON om.user_auth_id = u.auth_id 
    WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'super_admin')
    LIMIT 1
  )
);

-- 4. Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 5. Check if the invoice_documents table exists and has correct structure
-- (This should already exist from your schema, but let's verify)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_documents') THEN
        RAISE NOTICE 'invoice_documents table does not exist - please run your migration';
    ELSE
        RAISE NOTICE 'invoice_documents table exists';
    END IF;
END
$$;

-- 6. Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_documents TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 7. Test query to verify organization membership works
-- (Replace the auth.uid() with your actual user ID for testing)
SELECT 
  u.email,
  u.role,
  om.organization_uuid,
  o.name as organization_name
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE u.auth_id = auth.uid();
