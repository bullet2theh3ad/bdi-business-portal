-- Find where the 522 quantity is stored for shipment BDI-2025-875642
-- Check all columns in the shipments table
SELECT *
FROM shipments
WHERE id = '234e0f62-8e3f-49db-99fb-8605af5f39e0';

-- Check if there's a quantity in container_details JSONB
SELECT 
  shipment_number,
  container_details,
  container_details::text
FROM shipments
WHERE id = '234e0f62-8e3f-49db-99fb-8605af5f39e0';

-- Check shipment_line_items (even though it was empty before)
SELECT *
FROM shipment_line_items
WHERE shipment_id = '234e0f62-8e3f-49db-99fb-8605af5f39e0';

-- Check if there's a production_schedules entry with 522
SELECT 
  ps.quantity,
  ps.sku_id,
  pss.shipment_id
FROM production_schedules ps
JOIN production_schedule_shipments pss ON ps.id = pss.production_schedule_id
WHERE pss.shipment_id = '234e0f62-8e3f-49db-99fb-8605af5f39e0';

