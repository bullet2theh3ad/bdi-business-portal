-- Test what warehouse data we currently have in the database

-- Step 1: Check table structure (see what columns exist)
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'warehouses' 
ORDER BY ordinal_position;

-- Step 2: Check current warehouse data (see what's actually stored)
SELECT 
  id,
  warehouse_code,
  name,
  type,
  contact_name,
  contact_email,
  contact_phone,
  operating_hours,
  capabilities,
  -- Check if new columns exist
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'warehouses' AND column_name = 'contacts') 
    THEN contacts::text
    ELSE 'Column does not exist'
  END as contacts_data,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'warehouses' AND column_name = 'main_capabilities') 
    THEN main_capabilities::text
    ELSE 'Column does not exist'
  END as main_capabilities_data,
  created_at,
  updated_at
FROM warehouses
ORDER BY created_at DESC;

-- Step 3: Check specifically for the new columns
SELECT 
  COUNT(*) as warehouses_with_contacts_column
FROM information_schema.columns 
WHERE table_name = 'warehouses' 
AND column_name = 'contacts';

SELECT 
  COUNT(*) as warehouses_with_main_capabilities_column
FROM information_schema.columns 
WHERE table_name = 'warehouses' 
AND column_name = 'main_capabilities';
