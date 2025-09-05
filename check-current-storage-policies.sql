-- Check current Supabase Storage policies
-- Run this in your Supabase SQL Editor to see what policies exist

-- 1. Check if the organization-documents bucket exists
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at
FROM storage.buckets 
WHERE id = 'organization-documents';

-- 2. Check current storage policies
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

-- 3. Check if RLS is enabled on storage.objects
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 4. Check production files in database vs storage paths
SELECT 
  pf.id,
  pf.file_name,
  pf.file_path,
  pf.organization_id,
  o.code as org_code,
  pf.created_at
FROM production_files pf
JOIN organizations o ON pf.organization_id = o.id
ORDER BY pf.created_at DESC
LIMIT 10;

-- 5. Check organization connections that might affect file access
SELECT 
  oc.id,
  source_org.code as source_org,
  target_org.code as target_org,
  oc.permissions,
  oc.status
FROM organization_connections oc
JOIN organizations source_org ON oc.source_organization_id = source_org.id
JOIN organizations target_org ON oc.target_organization_id = target_org.id
WHERE oc.status = 'active';
