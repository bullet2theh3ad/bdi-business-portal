-- Step 2: Remove kdrennan@boundlessdevices.com from BDI organization and database
-- Run this ONLY after Step 1 confirms the user exists and you want to proceed

-- IMPORTANT: Run Step 1 first to verify user details before deletion!

BEGIN;

-- Get user auth_id for reference
DO $$
DECLARE
    user_auth_uuid UUID;
    user_org_uuid UUID;
BEGIN
    -- Get user's auth_id
    SELECT auth_id INTO user_auth_uuid 
    FROM users 
    WHERE email = 'kdrennan@boundlessdevices.com';
    
    IF user_auth_uuid IS NULL THEN
        RAISE NOTICE 'User kdrennan@boundlessdevices.com not found in database';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Found user auth_id: %', user_auth_uuid;
    
    -- Get BDI organization UUID
    SELECT id INTO user_org_uuid 
    FROM organizations 
    WHERE code = 'BDI';
    
    -- Step 1: Remove from organization membership
    DELETE FROM organization_members 
    WHERE user_auth_id = user_auth_uuid 
      AND organization_uuid = user_org_uuid;
    
    RAISE NOTICE 'Removed from BDI organization membership';
    
    -- Step 2: Delete API keys
    DELETE FROM api_keys 
    WHERE user_auth_id = user_auth_uuid;
    
    RAISE NOTICE 'Deleted API keys';
    
    -- Step 3: Update any records to remove user reference (set to NULL or system user)
    -- For forecasts, files, etc. - keep the data but remove user reference
    
    -- Option A: Set created_by to NULL (preserves data, removes user link)
    UPDATE sales_forecasts 
    SET created_by = NULL 
    WHERE created_by = user_auth_uuid;
    
    UPDATE production_files 
    SET uploaded_by = NULL 
    WHERE uploaded_by = user_auth_uuid;
    
    UPDATE invoices 
    SET created_by = NULL 
    WHERE created_by = user_auth_uuid;
    
    UPDATE shipments 
    SET created_by = NULL 
    WHERE created_by = user_auth_uuid;
    
    RAISE NOTICE 'Updated data records to remove user references';
    
    -- Step 4: Delete user record
    DELETE FROM users 
    WHERE auth_id = user_auth_uuid;
    
    RAISE NOTICE 'Deleted user record for kdrennan@boundlessdevices.com';
    RAISE NOTICE 'IMPORTANT: You must also delete this user from Supabase Auth manually!';
    
END $$;

COMMIT;

-- Verification: Check that user is completely removed
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM users WHERE email = 'kdrennan@boundlessdevices.com') 
    THEN '❌ USER STILL EXISTS - Deletion failed'
    ELSE '✅ USER SUCCESSFULLY REMOVED from database'
  END as deletion_status;

-- Check organization membership is removed
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM organization_members om 
      JOIN users u ON om.user_auth_id = u.auth_id 
      WHERE u.email = 'kdrennan@boundlessdevices.com'
    ) 
    THEN '❌ MEMBERSHIP STILL EXISTS'
    ELSE '✅ ORGANIZATION MEMBERSHIP REMOVED'
  END as membership_status;
