-- Debug organization ID issue for shipment creation

-- STEP 1: Check what organizations actually exist
SELECT 
  'AVAILABLE ORGANIZATIONS' as check_type,
  id,
  name,
  code,
  type,
  is_active
FROM organizations 
ORDER BY code;

-- STEP 2: Check what the problematic ID was trying to reference
SELECT 
  'PROBLEMATIC ID CHECK' as check_type,
  COUNT(*) as exists_count,
  CASE 
    WHEN COUNT(*) > 0 THEN 'ID EXISTS'
    ELSE 'ID DOES NOT EXIST'
  END as status
FROM organizations 
WHERE id = '0693f614-5d01-408a-82bd-6f0f6d54bc19';

-- STEP 3: Check MTN organization specifically (likely what should be used)
SELECT 
  'MTN ORGANIZATION CHECK' as check_type,
  id,
  name,
  code,
  type
FROM organizations 
WHERE code = 'MTN' OR name LIKE '%MTN%' OR name LIKE '%HUA ZHUANG%';

-- STEP 4: Check BDI organization (fallback)
SELECT 
  'BDI ORGANIZATION CHECK' as check_type,
  id,
  name,
  code,
  type
FROM organizations 
WHERE code = 'BDI' OR name LIKE '%Boundless%';
