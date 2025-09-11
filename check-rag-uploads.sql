to-- Check uploaded RAG documents in Supabase storage
-- Run this to see your uploaded files

-- 1. Check files in the storage.objects table
SELECT 
    name as file_path,
    bucket_id,
    owner,
    created_at,
    updated_at,
    last_accessed_at,
    metadata->>'size' as file_size_bytes,
    metadata->>'mimetype' as mime_type
FROM storage.objects 
WHERE bucket_id = 'organization-documents'
AND name LIKE 'rag-documents/%'
ORDER BY created_at DESC;

-- 2. Check specifically for BDI RAG documents
SELECT 
    name as file_path,
    created_at,
    metadata->>'size' as size_bytes,
    ROUND((metadata->>'size')::numeric / 1024, 2) as size_kb,
    metadata->>'mimetype' as file_type
FROM storage.objects 
WHERE bucket_id = 'organization-documents'
AND name LIKE 'rag-documents/BDI/%'
ORDER BY created_at DESC;

-- 3. Check the specific file that was just uploaded
SELECT 
    name,
    created_at,
    metadata->>'size' as size_bytes,
    metadata->>'mimetype' as mime_type,
    owner,
    bucket_id
FROM storage.objects 
WHERE name LIKE '%Boundless_Financial Model%'
OR name LIKE '%1757613399158%';

-- 4. Count RAG documents by company
SELECT 
    SPLIT_PART(SPLIT_PART(name, '/', 2), '/', 1) as company_code,
    COUNT(*) as file_count,
    SUM((metadata->>'size')::numeric) as total_bytes,
    ROUND(SUM((metadata->>'size')::numeric) / 1024 / 1024, 2) as total_mb
FROM storage.objects 
WHERE bucket_id = 'organization-documents'
AND name LIKE 'rag-documents/%'
GROUP BY SPLIT_PART(SPLIT_PART(name, '/', 2), '/', 1)
ORDER BY company_code;
