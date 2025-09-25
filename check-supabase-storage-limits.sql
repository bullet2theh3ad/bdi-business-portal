-- Check current Supabase storage policies and limits
-- Shows bucket policies, size limits, and upload restrictions

-- 1. Check all storage buckets and their policies
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
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;

-- 2. Check bucket configurations
SELECT 
  id,
  name,
  owner,
  created_at,
  updated_at,
  public,
  avif_autodetection,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
ORDER BY name;

-- 3. Check storage objects and their sizes (top 20 largest files)
SELECT 
  name,
  bucket_id,
  owner,
  created_at,
  updated_at,
  last_accessed_at,
  metadata->>'size' as file_size_bytes,
  ROUND((metadata->>'size')::numeric / 1024 / 1024, 2) as file_size_mb,
  metadata->>'mimetype' as mime_type,
  metadata->>'cacheControl' as cache_control
FROM storage.objects
WHERE bucket_id = 'organization-documents'
ORDER BY (metadata->>'size')::numeric DESC
LIMIT 20;

-- 4. Check production files specifically and their sizes
SELECT 
  pf.file_name,
  pf.file_size as db_file_size,
  ROUND(pf.file_size / 1024.0 / 1024.0, 2) as file_size_mb,
  pf.content_type,
  pf.file_type,
  o.name as organization,
  o.code as org_code,
  pf.created_at,
  u.name as uploaded_by_user
FROM production_files pf
JOIN organizations o ON pf.organization_id = o.id
JOIN users u ON pf.uploaded_by = u.auth_id
ORDER BY pf.file_size DESC
LIMIT 10;

-- 5. Show storage usage summary
SELECT 
  bucket_id,
  COUNT(*) as total_files,
  SUM((metadata->>'size')::numeric) as total_bytes,
  ROUND(SUM((metadata->>'size')::numeric) / 1024 / 1024, 2) as total_mb,
  ROUND(SUM((metadata->>'size')::numeric) / 1024 / 1024 / 1024, 2) as total_gb,
  MAX((metadata->>'size')::numeric) as largest_file_bytes,
  ROUND(MAX((metadata->>'size')::numeric) / 1024 / 1024, 2) as largest_file_mb,
  AVG((metadata->>'size')::numeric) as avg_file_size_bytes,
  ROUND(AVG((metadata->>'size')::numeric) / 1024 / 1024, 2) as avg_file_size_mb
FROM storage.objects
GROUP BY bucket_id
ORDER BY total_bytes DESC;
