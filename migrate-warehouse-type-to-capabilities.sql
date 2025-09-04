-- Migrate existing warehouse 'type' data to 'capabilities' array
-- Since 'capabilities' column already exists, we just need to populate it

-- Step 1: Check current data structure
SELECT 
  id,
  warehouse_code,
  name,
  type as current_type,
  capabilities as current_capabilities
FROM warehouses
ORDER BY name;

-- Step 2: Update capabilities to include the current type as an array
-- Only update if capabilities is currently empty or null
UPDATE warehouses 
SET capabilities = jsonb_build_array(type)
WHERE capabilities IS NULL 
   OR capabilities = 'null'::jsonb 
   OR capabilities = '[]'::jsonb 
   OR jsonb_array_length(capabilities) = 0;

-- Step 3: Verify the migration
SELECT 
  id,
  warehouse_code,
  name,
  type as old_type,
  capabilities as new_capabilities,
  jsonb_array_length(capabilities) as capability_count
FROM warehouses
ORDER BY name;

-- Step 4: Optional - Drop the old 'type' column after verifying data looks good
-- ALTER TABLE warehouses DROP COLUMN type;
