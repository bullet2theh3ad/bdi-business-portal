-- Find the BDI DB Backup Policy file in storage
-- Check Supabase storage for the uploaded file

-- Note: This query accesses the storage.objects table which may require service role access
-- If this doesn't work, check the Supabase Dashboard > Storage instead

SELECT 
    name as file_name,
    bucket_id,
    created_at as upload_date,
    updated_at,
    metadata,
    (metadata->>'size')::bigint as file_size_bytes,
    ROUND((metadata->>'size')::bigint / 1024.0, 1) as file_size_kb
FROM storage.objects 
WHERE name ILIKE '%backup%policy%' 
   OR name ILIKE '%BDI_DB_Backup_Policy%'
   OR name ILIKE '%bdi%backup%'
ORDER BY created_at DESC;
