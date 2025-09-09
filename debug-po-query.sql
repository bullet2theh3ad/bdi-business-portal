-- DEBUG: Test the exact query that should match the MTN PO

-- MTN org ID from logs: 54aa0aeb-eda2-41f6-958d-c37fa89ae86d
-- BDI org ID from our data: 85a60a82-9d78-4cd9-85a1-e7e62cac552b

-- 1. Test the PO query conditions
SELECT 
  'PO QUERY TEST' as test,
  po.id,
  po.purchase_order_number,
  po.supplier_name,
  po.organization_id,
  CASE 
    WHEN po.organization_id = '54aa0aeb-eda2-41f6-958d-c37fa89ae86d' THEN 'MTN is buyer ✅'
    WHEN po.supplier_name = 'MTN' THEN 'MTN is supplier ✅'
    ELSE 'No match ❌'
  END as match_reason
FROM purchase_orders po
WHERE po.organization_id = '54aa0aeb-eda2-41f6-958d-c37fa89ae86d'  -- MTN as buyer
   OR po.supplier_name = 'MTN';  -- MTN as supplier

-- 2. Test warehouse query conditions  
SELECT 
  'WAREHOUSE QUERY TEST' as test,
  w.id,
  w.warehouse_code,
  w.name,
  w.organization_id,
  w.is_active,
  CASE 
    WHEN w.organization_id = '54aa0aeb-eda2-41f6-958d-c37fa89ae86d' THEN 'MTN warehouse ✅'
    WHEN w.organization_id = '85a60a82-9d78-4cd9-85a1-e7e62cac552b' THEN 'BDI warehouse ✅'
    ELSE 'Other org ❌'
  END as match_reason
FROM warehouses w
WHERE (w.organization_id = '54aa0aeb-eda2-41f6-958d-c37fa89ae86d'  -- MTN warehouses
    OR w.organization_id = '85a60a82-9d78-4cd9-85a1-e7e62cac552b') -- BDI warehouses
  AND w.is_active = true;

-- 3. Check if is_active field might be the issue
SELECT 
  'WAREHOUSE ACTIVE CHECK' as test,
  warehouse_code,
  name,
  organization_id,
  is_active
FROM warehouses 
WHERE warehouse_code IN ('EMG', 'MTN-FACTORY', 'CAT');
