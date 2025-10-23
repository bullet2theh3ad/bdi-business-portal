-- Check what forecast_id is stored in the shipment
SELECT 
  s.id as shipment_id,
  s.shipment_number,
  s.forecast_id,
  s.created_at
FROM shipments s
WHERE s.id = '234e0f62-8e3f-49db-99fb-8605af5f39e0';

-- Try to find the forecast by matching the forecast_id
SELECT 
  f.id,
  f.quantity,
  f.sku_id,
  f.delivery_week,
  ps.sku,
  ps.name
FROM sales_forecasts f
LEFT JOIN product_skus ps ON f.sku_id = ps.id
WHERE f.id = '180fdca4-aabd-47c5-a274-f742f17ce44e';

-- Check if the forecast_id in shipment matches
SELECT 
  s.shipment_number,
  s.forecast_id,
  f.id as forecast_uuid,
  f.quantity
FROM shipments s
LEFT JOIN sales_forecasts f ON s.forecast_id::uuid = f.id
WHERE s.id = '234e0f62-8e3f-49db-99fb-8605af5f39e0';

