-- Step 1: Check current production files with TC1 paths
SELECT 
    id,
    file_name,
    file_path,
    organization_id,
    created_at
FROM production_files 
WHERE file_path LIKE '%TC1%'
ORDER BY created_at;

-- Step 2: Update file paths from TC1 to MTN in database
-- (Run this AFTER moving files in Supabase Storage)
UPDATE production_files 
SET file_path = REPLACE(file_path, '/TC1/', '/MTN/')
WHERE file_path LIKE '%/TC1/%';

-- Step 3: Update file paths for any remaining TC1 references
UPDATE production_files 
SET file_path = REPLACE(file_path, 'TC1', 'MTN')
WHERE file_path LIKE '%TC1%';

-- Step 4: Verify the updates
SELECT 
    id,
    file_name,
    file_path,
    organization_id,
    created_at
FROM production_files 
WHERE file_path LIKE '%MTN%'
ORDER BY created_at;

-- Step 5: Check for any remaining TC1 references
SELECT COUNT(*) as remaining_tc1_files
FROM production_files 
WHERE file_path LIKE '%TC1%';
