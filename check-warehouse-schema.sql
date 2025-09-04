-- Check current warehouse table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'warehouses' 
ORDER BY ordinal_position;

-- Check current warehouse data
SELECT 
  id,
  warehouse_code,
  name,
  type,
  capabilities,
  city,
  state
FROM warehouses
ORDER BY name;
