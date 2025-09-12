-- Check if CATV warehouse exists and show all current warehouses
SELECT 
  warehouse_code,
  name,
  type,
  city,
  state,
  country,
  contact_name,
  is_active
FROM warehouses
WHERE name ILIKE '%CATV%' OR name ILIKE '%Complete%' OR warehouse_code ILIKE '%CATV%'
ORDER BY created_at DESC;

-- Show all warehouses to see what exists
SELECT 
  warehouse_code,
  name,
  type,
  city || ', ' || COALESCE(state, country) as location,
  contact_name,
  is_active
FROM warehouses
ORDER BY name;
