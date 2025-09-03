-- Update production_files table to include PRODUCTION_FILE type
-- This adds the new file type to the existing constraint

-- Drop the existing constraint
ALTER TABLE production_files DROP CONSTRAINT IF EXISTS production_files_file_type_check;

-- Add the updated constraint with PRODUCTION_FILE
ALTER TABLE production_files ADD CONSTRAINT production_files_file_type_check 
CHECK (file_type IN (
  'PRODUCTION_FILE', 'MAC_ADDRESS_LIST', 'SERIAL_NUMBER_LIST', 'PRODUCTION_REPORT', 
  'TEST_RESULTS', 'CALIBRATION_DATA', 'FIRMWARE_VERSION', 
  'QUALITY_CONTROL', 'PACKAGING_LIST', 'OTHER'
));
