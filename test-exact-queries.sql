-- TEST: Exact queries that the API is running

-- From logs: MTN org ID = '54aa0aeb-eda2-41f6-958d-c37fa89ae86d'
-- From logs: BDI org ID = '85a60a82-9d78-4cd9-85a1-e7e62cac552b'

-- 1. Test MTN warehouses query (should be 0)
SELECT 'MTN WAREHOUSES' as test, COUNT(*) as count
FROM warehouses 
WHERE organization_id = '54aa0aeb-eda2-41f6-958d-c37fa89ae86d' 
  AND is_active = true;

-- 2. Test BDI warehouses query (should be 3)
SELECT 'BDI WAREHOUSES' as test, COUNT(*) as count
FROM warehouses 
WHERE organization_id = '85a60a82-9d78-4cd9-85a1-e7e62cac552b' 
  AND is_active = true;

-- 3. Show actual BDI warehouse org IDs to compare
SELECT 'ACTUAL WAREHOUSE ORG IDS' as test, warehouse_code, organization_id, is_active
FROM warehouses 
WHERE warehouse_code IN ('EMG', 'CAT', 'MTN-FACTORY');

-- 4. Test MTN as buyer POs (should be 0)
SELECT 'MTN BUYER POS' as test, COUNT(*) as count
FROM purchase_orders 
WHERE organization_id = '54aa0aeb-eda2-41f6-958d-c37fa89ae86d';

-- 5. Test MTN as supplier POs (should be 1)
SELECT 'MTN SUPPLIER POS' as test, COUNT(*) as count
FROM purchase_orders 
WHERE supplier_name = 'MTN';

-- 6. Show actual MTN PO details
SELECT 'ACTUAL MTN PO' as test, purchase_order_number, supplier_name, organization_id
FROM purchase_orders 
WHERE supplier_name = 'MTN';

-- 7. Check for data type issues - show organization IDs as text
SELECT 'ORG ID COMPARISON' as test, 
       'MTN' as org_code, 
       id::text as stored_id,
       '54aa0aeb-eda2-41f6-958d-c37fa89ae86d' as expected_id,
       (id::text = '54aa0aeb-eda2-41f6-958d-c37fa89ae86d') as ids_match
FROM organizations 
WHERE code = 'MTN'
UNION ALL
SELECT 'ORG ID COMPARISON' as test, 
       'BDI' as org_code, 
       id::text as stored_id,
       '85a60a82-9d78-4cd9-85a1-e7e62cac552b' as expected_id,
       (id::text = '85a60a82-9d78-4cd9-85a1-e7e62cac552b') as ids_match
FROM organizations 
WHERE code = 'BDI';
