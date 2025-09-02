-- Check the current status of all forecasts in the database
SELECT 
  id,
  sku_id,
  delivery_week,
  quantity,
  status,
  sales_signal,
  factory_signal,
  shipping_signal,
  created_at,
  updated_at,
  (updated_at > created_at) as was_updated
FROM sales_forecasts 
ORDER BY created_at DESC;

-- Check the status distribution
SELECT 
  status,
  COUNT(*) as count,
  SUM(quantity) as total_quantity
FROM sales_forecasts 
GROUP BY status
ORDER BY status;
