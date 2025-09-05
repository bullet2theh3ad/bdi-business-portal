-- Find the HSN forecast that won't delete
-- Run this in Supabase SQL Editor to get the forecast ID

-- 1. Find forecasts with HSN SKUs (look for HSN in the SKU code)
SELECT 
  sf.id as forecast_id,
  sf.sku_id,
  ps.sku as sku_code,
  ps.name as sku_name,
  sf.delivery_week,
  sf.quantity,
  sf.status,
  sf.created_at
FROM sales_forecasts sf
JOIN product_skus ps ON sf.sku_id = ps.id
WHERE ps.sku LIKE '%HSN%'
ORDER BY sf.created_at DESC;

-- 2. Alternative: Find all forecasts and look for the one you're trying to delete
SELECT 
  sf.id as forecast_id,
  ps.sku as sku_code,
  ps.name as sku_name,
  sf.delivery_week,
  sf.quantity,
  sf.status,
  sf.created_at
FROM sales_forecasts sf
JOIN product_skus ps ON sf.sku_id = ps.id
ORDER BY sf.created_at DESC
LIMIT 10;
