-- Show ALL warehouse data in a readable format

-- Current warehouse records with ALL data
SELECT 
  id,
  warehouse_code,
  name,
  type,
  address,
  city,
  state,
  country,
  postal_code,
  timezone,
  operating_hours,
  contact_name,
  contact_email,
  contact_phone,
  capabilities,
  contacts,
  main_capabilities,
  max_pallet_height_cm,
  max_pallet_weight_kg,
  loading_dock_count,
  storage_capacity_sqm,
  is_active,
  notes,
  created_at,
  updated_at,
  organization_id
FROM warehouses
ORDER BY created_at DESC;

-- Show just the key data in a more readable format
SELECT 
  warehouse_code,
  name,
  type,
  city || ', ' || state as location,
  contact_name,
  contact_email,
  capabilities::text as shipping_capabilities,
  contacts::text as all_contacts,
  main_capabilities::text as warehouse_operations,
  operating_hours,
  notes
FROM warehouses
ORDER BY created_at DESC;
