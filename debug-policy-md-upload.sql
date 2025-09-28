-- Debug why MD policy file isn't showing up

-- Check if there are any files in the policies folder in Supabase storage
-- Note: This is a conceptual query - Supabase storage doesn't use SQL directly
-- You'll need to check this in the Supabase dashboard or via API

-- Alternative: Check if there are any policy-related records in the database
-- (if policies are stored in database tables)

SELECT 
    'Debug: Check Supabase Storage' as info,
    'Go to Supabase Dashboard → Storage → organization-documents → policies folder' as instruction,
    'Look for PO-Number-Generation-Policy.md file' as what_to_find;

-- Check if there are any recent uploads in the application logs
SELECT 
    'Check Application Logs' as info,
    'Look for policy upload success/error messages' as instruction,
    'Check browser console for upload errors' as debugging_tip;

-- Possible issues:
SELECT 
    'Possible Issues:' as category,
    'File upload failed silently' as issue1,
    'MD file uploaded but not recognized by frontend' as issue2,
    'File uploaded to wrong path in storage' as issue3,
    'Frontend filtering out MD files due to contentType' as issue4;

-- Check content type handling
SELECT 
    'MD File Content Type Should Be:' as info,
    'text/markdown' as expected_content_type,
    'Check if frontend properly handles this MIME type' as note;
