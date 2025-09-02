-- Check all forecasts in the database to see their status values
-- This will help debug why orange bars are showing on the Dashboard

SELECT 
  id,
  sku_id,
  delivery_week,
  quantity,
  status,
  sales_signal,
  factory_signal,
  shipping_signal,
  created_at
FROM sales_forecasts 
ORDER BY created_at DESC;

-- Also check the distinct status values to see what's in there
SELECT DISTINCT status, COUNT(*) as count
FROM sales_forecasts 
GROUP BY status
ORDER BY status;
