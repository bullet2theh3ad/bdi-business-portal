-- Debug purchase order line items issue
-- Check if line items exist for the MTN purchase orders

-- First, let's see the purchase orders that MTN can see
SELECT 
  po.id,
  po.purchase_order_number,
  po.supplier_name,
  po.organization_id,
  po.total_value,
  po.status,
  org.code as buyer_org_code,
  org.name as buyer_org_name
FROM purchase_orders po
LEFT JOIN organizations org ON po.organization_id = org.id
WHERE po.purchase_order_number IN ('100080270457', '100040270379')
ORDER BY po.created_at DESC;

-- Check if there are ANY line items for these purchase orders
SELECT 
  poli.id,
  poli.purchase_order_id,
  poli.sku_code,
  poli.sku_name,
  poli.quantity,
  poli.unit_cost,
  poli.total_cost,
  po.purchase_order_number
FROM purchase_order_line_items poli
JOIN purchase_orders po ON poli.purchase_order_id = po.id
WHERE po.purchase_order_number IN ('100080270457', '100040270379')
ORDER BY poli.created_at;

-- Check total count of line items across all purchase orders
SELECT 
  COUNT(*) as total_line_items,
  COUNT(DISTINCT purchase_order_id) as pos_with_line_items
FROM purchase_order_line_items;

-- Show sample line items from any PO
SELECT 
  poli.id,
  poli.purchase_order_id,
  poli.sku_code,
  poli.sku_name,
  poli.quantity,
  po.purchase_order_number,
  po.supplier_name
FROM purchase_order_line_items poli
JOIN purchase_orders po ON poli.purchase_order_id = po.id
LIMIT 5;
