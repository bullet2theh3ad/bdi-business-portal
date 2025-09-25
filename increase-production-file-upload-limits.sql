-- Increase file upload limits for Production Files to support larger manufacturing files
-- Current limit: 10MB → New limit: 100MB for production files

-- 1. Update bucket file size limit (if bucket-level limits exist)
-- Note: Supabase buckets may not have individual size limits, check bucket config first

-- 2. Check current bucket configuration
SELECT 
  name,
  file_size_limit,
  allowed_mime_types,
  public
FROM storage.buckets 
WHERE name = 'organization-documents';

-- 3. If bucket has size limit, update it (uncomment if needed)
-- UPDATE storage.buckets 
-- SET file_size_limit = 104857600  -- 100MB in bytes
-- WHERE name = 'organization-documents';

-- 4. Create or update RLS policy for larger production files if needed
-- Most size limits are enforced at application level, not database level

-- 5. Verify no size constraints in storage policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND (qual LIKE '%size%' OR with_check LIKE '%size%');

-- 6. Check if there are any triggers or constraints on file size
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'storage'
  AND event_object_table = 'objects';

-- 7. Production files table schema check (no size constraints at DB level)
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'production_files'
  AND column_name = 'file_size';

-- RECOMMENDATION:
-- The main limit is likely in the frontend validation (lib/storage/supabase-storage.ts)
-- Update the maxSize constant from 10MB to 100MB:
-- const maxSize = 100 * 1024 * 1024; // 100MB instead of 10MB
