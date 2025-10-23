-- Check the forecast that created this shipment
SELECT 
  s.shipment_number,
  s.forecast_id,
  f.id as forecast_id_full,
  f.quantity as forecast_quantity,
  f.sku_id,
  ps.sku,
  ps.name
FROM shipments s
LEFT JOIN sales_forecasts f ON s.forecast_id::uuid = f.id
LEFT JOIN product_skus ps ON f.sku_id = ps.id
WHERE s.id = '234e0f62-8e3f-49db-99fb-8605af5f39e0';

-- Also check if container_details has quantity info
SELECT 
  s.shipment_number,
  s.container_details
FROM shipments s
WHERE s.id = '234e0f62-8e3f-49db-99fb-8605af5f39e0';

