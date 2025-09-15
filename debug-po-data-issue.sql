-- Debug: Why are Purchase Orders showing as 0 in Ask BDI?
-- Check if PO data exists and what the structure looks like

-- 1. Check if purchase_orders table exists and has data
SELECT 
  'PURCHASE ORDERS TABLE CHECK' as check_type,
  COUNT(*) as total_pos,
  SUM(total_value::numeric) as total_value_sum
FROM purchase_orders;

-- 2. Show actual PO records with details
SELECT 
  'ACTUAL PO RECORDS' as check_type,
  id,
  purchase_order_number,
  supplier_name,
  total_value,
  status,
  purchase_order_date,
  organization_id
FROM purchase_orders
ORDER BY created_at DESC;

-- 3. Check if purchase_order_line_items table exists and has data
SELECT 
  'PO LINE ITEMS CHECK' as check_type,
  COUNT(*) as total_line_items,
  COUNT(DISTINCT purchase_order_id) as pos_with_line_items
FROM purchase_order_line_items;

-- 4. Show sample line items with SKU details
SELECT 
  'SAMPLE LINE ITEMS' as check_type,
  poli.purchase_order_id,
  po.purchase_order_number,
  poli.sku_id,
  poli.sku_code,
  poli.sku_name,
  poli.quantity,
  poli.unit_cost,
  poli.total_cost
FROM purchase_order_line_items poli
JOIN purchase_orders po ON poli.purchase_order_id = po.id
ORDER BY po.created_at DESC, poli.sku_code
LIMIT 10;

-- 5. Check table schema to see field names
SELECT 
  'PO TABLE SCHEMA' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'purchase_orders'
ORDER BY ordinal_position;
