-- Check MTN warehouse contacts in database
-- Run this in Supabase SQL Editor

-- 1. Find MTN or Vietnam warehouse
SELECT 
  id,
  name,
  address,
  city,
  country,
  contacts,
  operating_hours,
  timezone,
  created_at
FROM warehouses 
WHERE name ILIKE '%MTN%' OR name ILIKE '%Vietnam%' OR name ILIKE '%HUA%'
ORDER BY created_at DESC;

-- 2. Check all warehouse contacts to see the format
SELECT 
  id,
  name,
  contacts,
  created_at
FROM warehouses 
WHERE contacts IS NOT NULL
ORDER BY created_at DESC;
