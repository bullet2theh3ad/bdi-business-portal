-- Check actual PO data to see why Ask BDI shows 0 POs

-- 1. Show all PO records with their values
SELECT 
  'ACTUAL PO RECORDS' as check_type,
  id,
  purchase_order_number,
  supplier_name,
  total_value,
  status,
  organization_id,
  created_at
FROM purchase_orders
ORDER BY created_at DESC;

-- 2. Check total count and value
SELECT 
  'PO SUMMARY' as check_type,
  COUNT(*) as total_pos,
  SUM(total_value) as total_value_all_pos,
  AVG(total_value) as avg_po_value
FROM purchase_orders;

-- 3. Check line items connection
SELECT 
  'LINE ITEMS CONNECTION' as check_type,
  po.purchase_order_number,
  po.total_value as po_total,
  COUNT(poli.id) as line_items_count,
  SUM(poli.total_cost) as line_items_total
FROM purchase_orders po
LEFT JOIN purchase_order_line_items poli ON po.id = poli.purchase_order_id
GROUP BY po.id, po.purchase_order_number, po.total_value
ORDER BY po.created_at DESC;
