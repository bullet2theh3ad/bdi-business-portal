-- Debug what organizations are returned by /api/admin/organizations?includeInternal=true

-- Check ALL organizations in the database
SELECT 
  'ALL ORGANIZATIONS' as check_type,
  id,
  name,
  code,
  type,
  is_active
FROM organizations 
ORDER BY code;

-- Check specifically what should be returned for includeInternal=true
SELECT 
  'INTERNAL ORGS' as check_type,
  id,
  name,
  code,
  type
FROM organizations 
WHERE type = 'internal';

-- Check if the problematic ID exists anywhere
SELECT 
  'PROBLEMATIC ID' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM organizations WHERE id = '0693f614-5d01-408a-82bd-6f0f6d54bc19')
    THEN 'EXISTS'
    ELSE 'DOES NOT EXIST'
  END as status;
