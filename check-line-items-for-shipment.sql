-- Check if this specific shipment has line items
SELECT 
  sli.id as line_item_id,
  sli.shipment_id,
  sli.quantity,
  sli.sku_id,
  ps.sku,
  ps.name
FROM shipment_line_items sli
LEFT JOIN product_skus ps ON sli.sku_id = ps.id
WHERE sli.shipment_id = '234e0f62-8e3f-49db-99fb-8605af5f39e0';

-- Also check total count of line items in the table
SELECT COUNT(*) as total_line_items
FROM shipment_line_items;

-- Check if there are ANY shipments with line items
SELECT 
  s.shipment_number,
  COUNT(sli.id) as line_item_count,
  SUM(sli.quantity) as total_quantity
FROM shipments s
LEFT JOIN shipment_line_items sli ON s.id = sli.shipment_id
GROUP BY s.id, s.shipment_number
HAVING COUNT(sli.id) > 0
LIMIT 5;

