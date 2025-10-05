-- Check the specific MTN purchase orders from the UI screenshot
-- to confirm they have no line items

-- First, get the actual IDs for these PO numbers
SELECT 
  id,
  purchase_order_number,
  supplier_name,
  organization_id,
  total_value,
  status
FROM purchase_orders 
WHERE purchase_order_number IN ('100080270457', '100040270379');

-- Check if these specific POs have any line items
SELECT 
  poli.*,
  po.purchase_order_number
FROM purchase_order_line_items poli
JOIN purchase_orders po ON poli.purchase_order_id = po.id
WHERE po.purchase_order_number IN ('100080270457', '100040270379');

-- Show which POs DO have line items (for comparison)
SELECT DISTINCT
  po.purchase_order_number,
  po.supplier_name,
  COUNT(poli.id) as line_item_count
FROM purchase_orders po
LEFT JOIN purchase_order_line_items poli ON po.id = poli.purchase_order_id
GROUP BY po.id, po.purchase_order_number, po.supplier_name
HAVING COUNT(poli.id) > 0
ORDER BY line_item_count DESC;
