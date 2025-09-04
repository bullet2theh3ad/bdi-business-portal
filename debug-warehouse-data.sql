-- Debug what's actually being saved in warehouses table

-- Check the structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'warehouses' 
ORDER BY ordinal_position;

-- Check actual warehouse data
SELECT 
  id,
  warehouse_code,
  name,
  type,
  capabilities,
  contact_name,
  contact_email,
  contact_phone,
  operating_hours
FROM warehouses
ORDER BY created_at DESC;

-- Check if contacts column exists
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'warehouses' 
AND column_name = 'contacts';
