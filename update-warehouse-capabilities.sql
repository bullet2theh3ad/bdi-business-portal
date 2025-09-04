-- Update warehouses table to support multiple capabilities instead of single type

-- Step 1: Add the new capabilities column (JSONB array)
ALTER TABLE warehouses 
ADD COLUMN capabilities JSONB NOT NULL DEFAULT '[]';

-- Step 2: Migrate existing 'type' data to 'capabilities' array
-- Convert single type to array format
UPDATE warehouses 
SET capabilities = jsonb_build_array(type)
WHERE type IS NOT NULL;

-- Step 3: Verify the migration
SELECT 
  id,
  warehouse_code,
  name,
  type as old_type,
  capabilities as new_capabilities
FROM warehouses
ORDER BY name;

-- Step 4: Drop the old 'type' column (after verifying data looks good)
-- ALTER TABLE warehouses DROP COLUMN type;

-- Note: Uncomment the DROP COLUMN command above after verifying the migration worked correctly
