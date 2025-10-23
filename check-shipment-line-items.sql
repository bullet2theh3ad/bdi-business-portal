-- Check the structure of shipment_line_items table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shipment_line_items'
ORDER BY ordinal_position;

-- Also check what data exists
SELECT 
  sli.shipment_id,
  sli.sku_id,
  sli.quantity,
  s.shipment_number
FROM shipment_line_items sli
LEFT JOIN shipments s ON sli.shipment_id = s.id
LIMIT 5;

