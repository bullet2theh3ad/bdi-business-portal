-- First check what columns exist in sales_forecasts
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sales_forecasts'
ORDER BY ordinal_position;

-- Get the forecast_id from the shipment
SELECT 
  s.id as shipment_id,
  s.shipment_number,
  s.forecast_id,
  s.created_at
FROM shipments s
WHERE s.id = '234e0f62-8e3f-49db-99fb-8605af5f39e0';

-- Check some sample forecasts
SELECT *
FROM sales_forecasts
LIMIT 3;

