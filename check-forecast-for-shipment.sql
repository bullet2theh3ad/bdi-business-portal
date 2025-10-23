-- Get the forecast_id from the shipment
SELECT 
  s.id as shipment_id,
  s.shipment_number,
  s.forecast_id,
  s.created_at
FROM shipments s
WHERE s.id = '234e0f62-8e3f-49db-99fb-8605af5f39e0';

-- Check if there's a sales_forecasts table and what it contains
SELECT 
  f.id,
  f.quantity,
  f.sku_id,
  f.period,
  ps.sku,
  ps.name
FROM sales_forecasts f
LEFT JOIN product_skus ps ON f.sku_id = ps.id
LIMIT 5;

-- Try to find the forecast by the forecast_id from shipment
-- (forecast_id might be stored as varchar, not uuid)
SELECT 
  f.id,
  f.quantity,
  f.sku_id,
  ps.sku,
  ps.name
FROM sales_forecasts f
LEFT JOIN product_skus ps ON f.sku_id = ps.id
WHERE f.id::text LIKE '%234e0f62%' OR f.id::text IN (
  SELECT forecast_id FROM shipments WHERE id = '234e0f62-8e3f-49db-99fb-8605af5f39e0'
);

