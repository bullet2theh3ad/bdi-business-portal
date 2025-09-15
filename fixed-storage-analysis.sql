-- FIXED SUPABASE STORAGE ANALYSIS - No GROUP BY errors
-- Complete directory and file structure analysis for Ask BDI

-- 1. ALL STORAGE BUCKETS
SELECT 
  'STORAGE BUCKETS' as analysis_type,
  id,
  name,
  created_at,
  updated_at,
  public
FROM storage.buckets
ORDER BY created_at;

-- 2. ALL FILES WITH DIRECTORY BREAKDOWN
SELECT 
  'ALL FILES STRUCTURE' as analysis_type,
  bucket_id,
  name as full_path,
  CASE 
    WHEN name LIKE '%/%' THEN 
      regexp_replace(name, '/[^/]*$', '') 
    ELSE 
      'ROOT'
  END as directory_path,
  CASE 
    WHEN name LIKE '%/%' THEN 
      regexp_replace(name, '^.*/', '') 
    ELSE 
      name
  END as filename,
  CASE 
    WHEN name LIKE '%.%' THEN 
      regexp_replace(name, '^.*\.', '') 
    ELSE 
      'NO_EXTENSION'
  END as file_extension,
  (metadata->>'size')::bigint as file_size_bytes,
  metadata->>'mimetype' as mime_type,
  created_at
FROM storage.objects
ORDER BY bucket_id, directory_path, filename;

-- 3. DIRECTORY SUMMARY BY BUCKET
SELECT 
  'DIRECTORY SUMMARY' as analysis_type,
  bucket_id,
  CASE 
    WHEN name LIKE '%/%' THEN 
      regexp_replace(name, '/[^/]*$', '')
    ELSE 
      'ROOT'
  END as directory_path,
  COUNT(*) as files_count,
  SUM(COALESCE((metadata->>'size')::bigint, 0)) as total_size_bytes
FROM storage.objects
GROUP BY bucket_id, directory_path
ORDER BY bucket_id, directory_path;

-- 4. ORGANIZATION DIRECTORIES (UUID-based)
SELECT 
  'ORGANIZATION DIRECTORIES' as analysis_type,
  bucket_id,
  substring(name from '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})') as organization_id,
  COUNT(*) as files_count
FROM storage.objects
WHERE name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
GROUP BY bucket_id, organization_id
ORDER BY bucket_id, files_count DESC;

-- 5. RAG DOCUMENTS BY COMPANY
SELECT 
  'RAG DOCUMENTS BY COMPANY' as analysis_type,
  bucket_id,
  regexp_replace(name, '^rag-documents/([^/]+).*', '\1') as rag_company,
  COUNT(*) as files_count
FROM storage.objects
WHERE name LIKE 'rag-documents/%'
GROUP BY bucket_id, rag_company
ORDER BY bucket_id, files_count DESC;

-- 6. FILE TYPES BY BUCKET
SELECT 
  'FILE TYPES BY BUCKET' as analysis_type,
  bucket_id,
  CASE 
    WHEN name LIKE '%.%' THEN 
      regexp_replace(name, '^.*\.', '')
    ELSE 
      'NO_EXTENSION'
  END as file_extension,
  COUNT(*) as files_count,
  SUM(COALESCE((metadata->>'size')::bigint, 0)) as total_size_bytes
FROM storage.objects
GROUP BY bucket_id, file_extension
ORDER BY bucket_id, files_count DESC;

-- 7. RECENT FILES (LAST 30 DAYS)
SELECT 
  'RECENT FILES' as analysis_type,
  bucket_id,
  name as file_path,
  (metadata->>'size')::bigint as file_size_bytes,
  metadata->>'mimetype' as mime_type,
  created_at
FROM storage.objects
WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY bucket_id, created_at DESC
LIMIT 50;

-- 8. LARGE FILES (>1MB)
SELECT 
  'LARGE FILES' as analysis_type,
  bucket_id,
  name as file_path,
  (metadata->>'size')::bigint as file_size_bytes,
  ROUND((metadata->>'size')::bigint / 1024.0 / 1024.0, 2) as file_size_mb,
  metadata->>'mimetype' as mime_type,
  created_at
FROM storage.objects
WHERE (metadata->>'size')::bigint > 1048576
ORDER BY (metadata->>'size')::bigint DESC
LIMIT 20;

-- 9. DIRECTORY DEPTH ANALYSIS
SELECT 
  'DIRECTORY DEPTH' as analysis_type,
  bucket_id,
  array_length(string_to_array(name, '/'), 1) - 1 as directory_depth,
  COUNT(*) as files_at_depth
FROM storage.objects
GROUP BY bucket_id, directory_depth
ORDER BY bucket_id, directory_depth;

-- 10. TEMPLATE AND SYSTEM FILES
SELECT 
  'TEMPLATE AND SYSTEM FILES' as analysis_type,
  bucket_id,
  name as file_path,
  (metadata->>'size')::bigint as file_size_bytes,
  created_at
FROM storage.objects
WHERE name ILIKE '%template%' 
   OR name ILIKE '%system%'
   OR name ILIKE '%config%'
ORDER BY bucket_id, created_at DESC;

-- 11. FILE NAMING PATTERNS
SELECT 
  'FILE NAMING PATTERNS' as analysis_type,
  bucket_id,
  CASE 
    WHEN name ~ '^\d{13}_' THEN 'TIMESTAMP_PREFIX'
    WHEN name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' THEN 'UUID_DIRECTORY'
    WHEN name LIKE 'rag-documents/%' THEN 'RAG_DOCUMENTS'
    WHEN name LIKE 'templates/%' THEN 'TEMPLATES'
    WHEN name LIKE '%/%' THEN 'NESTED_DIRECTORY'
    ELSE 'ROOT_LEVEL'
  END as naming_pattern,
  COUNT(*) as files_count
FROM storage.objects
GROUP BY bucket_id, naming_pattern
ORDER BY bucket_id, files_count DESC;

-- 12. SPECIFIC DIRECTORY CONTENTS
-- Show actual files in key directories
SELECT 
  'ORGANIZATION-DOCUMENTS CONTENTS' as analysis_type,
  name as file_path,
  (metadata->>'size')::bigint as file_size_bytes,
  created_at
FROM storage.objects
WHERE bucket_id = 'organization-documents'
  AND created_at > NOW() - INTERVAL '60 days'
ORDER BY created_at DESC
LIMIT 30;

SELECT 
  'BDI-DOCUMENTS CONTENTS' as analysis_type,
  name as file_path,
  (metadata->>'size')::bigint as file_size_bytes,
  created_at
FROM storage.objects
WHERE bucket_id = 'bdi-documents'
ORDER BY created_at DESC
LIMIT 20;

SELECT 
  'SHIPMENT-DOCUMENTS CONTENTS' as analysis_type,
  name as file_path,
  (metadata->>'size')::bigint as file_size_bytes,
  created_at
FROM storage.objects
WHERE bucket_id = 'shipment-documents'
ORDER BY created_at DESC
LIMIT 20;
