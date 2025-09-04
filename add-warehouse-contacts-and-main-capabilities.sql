-- Add missing fields to warehouses table for new contact and capabilities system

-- Step 1: Add contacts column (JSONB array)
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]';

-- Step 2: Add main_capabilities column (JSONB array for warehouse operations)
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS main_capabilities JSONB DEFAULT '[]';

-- Step 3: Verify the new columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'warehouses' 
AND column_name IN ('contacts', 'main_capabilities')
ORDER BY column_name;

-- Step 4: Check current data
SELECT 
  id,
  warehouse_code,
  name,
  type,
  main_capabilities,
  contacts,
  contact_name,
  contact_email,
  capabilities
FROM warehouses
ORDER BY name;
