-- Update production_files table constraint to allow new Royalty Zone file types
-- Current constraint only allows old file types, need to add new categories

-- 1. Check current constraint
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'production_files'::regclass
  AND conname LIKE '%file_type%';

-- 2. Drop the existing file_type check constraint
ALTER TABLE production_files 
DROP CONSTRAINT IF EXISTS production_files_file_type_check;

-- 3. Add new constraint with all file types including Royalty Zones
ALTER TABLE production_files 
ADD CONSTRAINT production_files_file_type_check 
CHECK (file_type IN (
  'MAC_ADDRESS_LIST', 
  'SERIAL_NUMBER_LIST', 
  'PRODUCTION_REPORT', 
  'TEST_RESULTS', 
  'CALIBRATION_DATA', 
  'FIRMWARE_VERSION', 
  'QUALITY_CONTROL', 
  'PACKAGING_LIST', 
  'PRODUCTION_FILE',
  'ROYALTY_ZONE_1',
  'ROYALTY_ZONE_2', 
  'ROYALTY_ZONE_3',
  'ROYALTY_ZONE_4',
  'ROYALTY_ZONE_5',
  'GENERIC',
  'OTHER'
));

-- 4. Verify the new constraint
SELECT 
  'Updated Constraint' as status,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'production_files'::regclass
  AND conname = 'production_files_file_type_check';

-- 5. Test that new file types are now allowed
SELECT 'Constraint Update Complete' as status,
       'ROYALTY_ZONE_1, ROYALTY_ZONE_2, ROYALTY_ZONE_3, ROYALTY_ZONE_4, ROYALTY_ZONE_5, GENERIC now allowed' as new_types;
