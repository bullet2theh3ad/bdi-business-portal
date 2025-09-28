-- Inspect existing policy file metadata
-- File: 1758772526378_BDI_DB_Backup_Policy_R1.docx

-- First, let's check if there are any database tables that store file metadata
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND (
    table_name ILIKE '%file%' OR 
    table_name ILIKE '%document%' OR 
    table_name ILIKE '%policy%' OR
    table_name ILIKE '%upload%' OR
    table_name ILIKE '%storage%'
)
ORDER BY table_name, ordinal_position;

-- Check if there's a dedicated policies or documents table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (
    table_name ILIKE '%policy%' OR
    table_name ILIKE '%document%' OR
    table_name ILIKE '%file%'
);

-- Let's also check all tables to see if any might store file metadata
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if there are any records that might reference our file
-- (This is a conceptual query - we'll need to check actual table structures)
SELECT 'Check for file references in existing tables' as note;

-- The file metadata we saw in logs:
SELECT 'File Info from Logs:' as info,
       '1758772526378_BDI_DB_Backup_Policy_R1.docx' as filename,
       'policies/' as storage_path,
       'organization-documents' as bucket,
       'category: database' as logged_metadata,
       'description: BDI Database Backup Policy - Revision 1' as logged_description,
       'uploaderName: Steven Cistulli' as logged_uploader;

-- Note: Supabase Storage metadata is typically stored in the storage.objects table
-- Let's check if we have access to that
SELECT 'Attempting to access storage.objects table' as note;

-- Try to query storage schema (may not have permission)
SELECT * FROM storage.objects 
WHERE name LIKE '%BDI_DB_Backup_Policy%' 
LIMIT 5;
