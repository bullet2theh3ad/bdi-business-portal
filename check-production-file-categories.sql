-- Check production file categories and labels
-- Ensure GPN and other partners see files with correct categorization

-- Check all file types and their counts
SELECT 
    'File Type Distribution:' as analysis,
    file_type,
    COUNT(*) as count,
    STRING_AGG(DISTINCT organization_id::text, ', ') as organizations
FROM production_files 
GROUP BY file_type
ORDER BY count DESC;

-- Check specific files GPN can see with their categories
SELECT 
    'GPN Accessible Files:' as analysis,
    pf.file_name,
    pf.file_type,
    pf.description,
    pf.tags,
    o.code as org_code,
    pf.created_at
FROM production_files pf
JOIN organizations o ON pf.organization_id = o.id
WHERE pf.organization_id IN (
    -- GPN's own files
    'b93954ef-f856-406b-9e8f-3236a7ae0f90',
    -- MTN files (GPN can access via connection)
    '54aa0aeb-eda2-41f6-958d-c37fa89ae86d',
    -- BDI files (GPN can access via connection) 
    '85a60a82-9d78-4cd9-85a1-e7e62cac552b'
)
ORDER BY pf.file_type, pf.created_at DESC;

-- Check if file types need better categorization
SELECT 
    'File Type Analysis:' as analysis,
    file_type,
    CASE 
        WHEN file_type = 'PRODUCTION_FILE' THEN 'Production Files'
        WHEN file_type = 'ROYALTY_ZONE_4' THEN 'Royalty Zone 4 Files'
        WHEN file_type = 'production' THEN 'Production Files'
        ELSE file_type
    END as display_category,
    COUNT(*) as count
FROM production_files
GROUP BY file_type
ORDER BY count DESC;

-- Check if we need to add a display_category field
SELECT 
    'Current Schema:' as info,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'production_files' 
    AND column_name IN ('file_type', 'description', 'tags')
ORDER BY column_name;
