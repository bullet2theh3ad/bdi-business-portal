-- Show all file types available in the system
-- This will help us understand what file type filters to add to the API

-- Get all unique file types with examples
SELECT 
    file_type,
    COUNT(*) as file_count,
    STRING_AGG(DISTINCT file_name, ' | ') as example_files,
    STRING_AGG(DISTINCT o.code, ', ') as organizations
FROM production_files pf
LEFT JOIN organizations o ON pf.organization_id = o.id
GROUP BY file_type
ORDER BY file_count DESC;

-- Show file types by organization
SELECT 
    'File Types by Organization:' as analysis,
    o.code as org_code,
    pf.file_type,
    COUNT(*) as count
FROM production_files pf
LEFT JOIN organizations o ON pf.organization_id = o.id
GROUP BY o.code, pf.file_type
ORDER BY o.code, count DESC;
