-- COMPREHENSIVE SUPABASE STORAGE ANALYSIS FOR ASK BDI FILE ACCESS
-- This will show all buckets, directories, and file structures

-- 1. GET ALL STORAGE BUCKETS
SELECT 
  'STORAGE BUCKETS' as analysis_type,
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
ORDER BY created_at;

-- 2. GET ALL FILES IN ALL BUCKETS WITH DIRECTORY STRUCTURE
SELECT 
  'ALL FILES ANALYSIS' as analysis_type,
  bucket_id,
  name as file_path,
  -- Extract directory structure
  CASE 
    WHEN name LIKE '%/%' THEN 
      regexp_replace(name, '/[^/]*$', '') -- Remove filename, keep directory path
    ELSE 
      'ROOT'
  END as directory_path,
  -- Extract just filename
  CASE 
    WHEN name LIKE '%/%' THEN 
      regexp_replace(name, '^.*/', '') -- Remove directory path, keep filename
    ELSE 
      name
  END as filename,
  -- Extract file extension
  CASE 
    WHEN name LIKE '%.%' THEN 
      regexp_replace(name, '^.*\.', '') -- Get extension
    ELSE 
      'NO_EXTENSION'
  END as file_extension,
  metadata,
  created_at,
  updated_at,
  last_accessed_at,
  id
FROM storage.objects
ORDER BY bucket_id, directory_path, filename;

-- 3. DIRECTORY STRUCTURE ANALYSIS BY BUCKET
SELECT 
  'DIRECTORY STRUCTURE BY BUCKET' as analysis_type,
  bucket_id,
  CASE 
    WHEN name LIKE '%/%' THEN 
      regexp_replace(name, '/[^/]*$', '')
    ELSE 
      'ROOT'
  END as directory_path,
  COUNT(*) as files_count,
  SUM((metadata->>'size')::bigint) as total_size_bytes,
  AVG((metadata->>'size')::bigint) as avg_file_size,
  MIN(created_at) as oldest_file,
  MAX(created_at) as newest_file
FROM storage.objects
GROUP BY bucket_id, directory_path
ORDER BY bucket_id, directory_path;

-- 4. FILE TYPE ANALYSIS BY BUCKET
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

-- 5. ORGANIZATION-SPECIFIC DIRECTORIES
SELECT 
  'ORGANIZATION DIRECTORIES' as analysis_type,
  bucket_id,
  CASE 
    WHEN name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' THEN
      substring(name from '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
    ELSE
      'NOT_ORG_SPECIFIC'
  END as organization_id,
  COUNT(*) as files_in_org_dir,
  array_agg(name ORDER BY created_at DESC) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent_files
FROM storage.objects
WHERE name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
GROUP BY bucket_id, organization_id
ORDER BY bucket_id, files_in_org_dir DESC;

-- 6. RAG DOCUMENTS DIRECTORY ANALYSIS
SELECT 
  'RAG DIRECTORY STRUCTURE' as analysis_type,
  bucket_id,
  CASE 
    WHEN name LIKE 'rag-documents/%' THEN
      regexp_replace(name, '^rag-documents/([^/]+).*', '\1')
    ELSE
      'NOT_RAG'
  END as rag_company,
  COUNT(*) as files_count,
  array_agg(name ORDER BY created_at DESC) as file_paths
FROM storage.objects
WHERE name LIKE 'rag-documents/%'
GROUP BY bucket_id, rag_company
ORDER BY bucket_id, files_count DESC;

-- 7. RECENT FILES BY BUCKET (MOST RELEVANT)
SELECT 
  'RECENT FILES BY BUCKET' as analysis_type,
  bucket_id,
  name as file_path,
  metadata->>'size' as file_size,
  metadata->>'mimetype' as mime_type,
  created_at,
  updated_at
FROM storage.objects
WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY bucket_id, created_at DESC
LIMIT 50;

-- 8. TEMPLATE AND SYSTEM FILES
SELECT 
  'TEMPLATE AND SYSTEM FILES' as analysis_type,
  bucket_id,
  name as file_path,
  metadata->>'size' as file_size,
  created_at
FROM storage.objects
WHERE name LIKE '%template%' 
   OR name LIKE '%system%'
   OR name LIKE '%config%'
ORDER BY bucket_id, created_at DESC;

-- 9. LARGE FILES ANALYSIS (>1MB)
SELECT 
  'LARGE FILES ANALYSIS' as analysis_type,
  bucket_id,
  name as file_path,
  (metadata->>'size')::bigint as file_size_bytes,
  ROUND((metadata->>'size')::bigint / 1024.0 / 1024.0, 2) as file_size_mb,
  metadata->>'mimetype' as mime_type,
  created_at
FROM storage.objects
WHERE (metadata->>'size')::bigint > 1048576  -- > 1MB
ORDER BY (metadata->>'size')::bigint DESC
LIMIT 20;

-- 10. DIRECTORY DEPTH ANALYSIS
SELECT 
  'DIRECTORY DEPTH ANALYSIS' as analysis_type,
  bucket_id,
  array_length(string_to_array(name, '/'), 1) - 1 as directory_depth,
  COUNT(*) as files_at_depth,
  array_agg(name ORDER BY created_at DESC) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent_examples
FROM storage.objects
GROUP BY bucket_id, directory_depth
ORDER BY bucket_id, directory_depth;

-- 11. FILE NAMING PATTERNS (TIMESTAMP PREFIXES)
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
  COUNT(*) as files_count,
  array_agg(name ORDER BY created_at DESC) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent_examples
FROM storage.objects
GROUP BY bucket_id, naming_pattern
ORDER BY bucket_id, files_count DESC;
