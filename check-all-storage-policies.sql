-- Check all storage policies to find conflicts
-- This will show us ALL policies on storage.objects

SELECT 
    policyname, 
    cmd as operation,
    permissive,
    roles,
    with_check,
    qual as using_clause
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
ORDER BY cmd, policyname;

-- Also check if there are any RESTRICTIVE policies that might be blocking
SELECT 
    policyname,
    permissive,
    cmd,
    CASE 
        WHEN permissive = 'PERMISSIVE' THEN 'ALLOWS'
        WHEN permissive = 'RESTRICTIVE' THEN 'BLOCKS'
    END as policy_type
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND cmd = 'INSERT'
ORDER BY permissive DESC, policyname;
