-- Check if shipment 234e0f62 has line items
SELECT 
  s.id as shipment_id,
  s.shipment_number,
  sli.id as line_item_id,
  sli.quantity,
  ps.sku,
  ps.name
FROM shipments s
LEFT JOIN shipment_line_items sli ON s.id = sli.shipment_id
LEFT JOIN product_skus ps ON sli.sku_id = ps.id
WHERE s.shipment_number = '234e0f62';

-- Also check if there are ANY line items in the table
SELECT COUNT(*) as total_line_items
FROM shipment_line_items;

-- Check the structure of production_schedule_shipments
SELECT 
  pss.production_schedule_id,
  pss.shipment_id,
  s.shipment_number
FROM production_schedule_shipments pss
LEFT JOIN shipments s ON pss.shipment_id = s.id
WHERE pss.production_schedule_id = 'e887e41d-dde0-4951-8af0-1fd3e213528f';

