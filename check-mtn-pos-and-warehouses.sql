-- CHECK: MTN Purchase Orders and Warehouses Tagging
-- This will show us exactly what POs and warehouses exist and how they're tagged

-- 1. Check ALL Purchase Orders and their tagging
SELECT 
  'ALL PURCHASE ORDERS' as status,
  po.id,
  po.purchase_order_number,
  po.supplier_name,
  po.organization_id,
  o.code as buyer_org_code,
  o.name as buyer_org_name,
  po.status,
  po.total_value,
  po.created_at
FROM purchase_orders po
JOIN organizations o ON po.organization_id = o.id
ORDER BY po.created_at DESC;

-- 2. Check specifically for MTN-related Purchase Orders
SELECT 
  'MTN PURCHASE ORDERS' as status,
  po.id,
  po.purchase_order_number,
  po.supplier_name,
  po.organization_id,
  o.code as buyer_org_code,
  o.name as buyer_org_name,
  po.status,
  po.total_value,
  CASE 
    WHEN po.supplier_name = 'MTN' THEN 'MTN is supplier'
    WHEN o.code = 'MTN' THEN 'MTN is buyer'
    ELSE 'No MTN relation found'
  END as mtn_relation
FROM purchase_orders po
JOIN organizations o ON po.organization_id = o.id
WHERE po.supplier_name = 'MTN' 
   OR o.code = 'MTN'
ORDER BY po.created_at DESC;

-- 3. Check ALL Warehouses and their organization tagging
SELECT 
  'ALL WAREHOUSES' as status,
  w.id,
  w.warehouse_code,
  w.name,
  w.organization_id,
  o.code as org_code,
  o.name as org_name,
  o.type as org_type,
  w.address,
  w.created_at
FROM warehouses w
JOIN organizations o ON w.organization_id = o.id
ORDER BY o.code, w.warehouse_code;

-- 4. Check specifically EMG warehouse (the one MTN should see)
SELECT 
  'EMG WAREHOUSE DETAILS' as status,
  w.id,
  w.warehouse_code,
  w.name,
  w.organization_id,
  o.code as org_code,
  o.name as org_name,
  o.type as org_type,
  w.address
FROM warehouses w
JOIN organizations o ON w.organization_id = o.id
WHERE w.warehouse_code = 'EMG';

-- 5. Check MTN organization ID for reference
SELECT 
  'MTN ORGANIZATION' as status,
  id,
  code,
  name,
  type,
  created_at
FROM organizations
WHERE code = 'MTN';

-- 6. Check BDI organization ID for reference
SELECT 
  'BDI ORGANIZATION' as status,
  id,
  code,
  name,
  type,
  created_at
FROM organizations
WHERE code = 'BDI';
