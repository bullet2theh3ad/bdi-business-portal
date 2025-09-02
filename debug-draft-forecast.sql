-- Debug which forecast is still in draft status
SELECT 
  sf.id,
  sf.sku_id,
  ps.sku as sku_code,
  ps.name as sku_name,
  sf.delivery_week,
  sf.quantity,
  sf.status,
  sf.sales_signal,
  sf.factory_signal,
  sf.shipping_signal,
  sf.created_at,
  sf.updated_at
FROM sales_forecasts sf
LEFT JOIN product_skus ps ON ps.id = sf.sku_id
ORDER BY sf.created_at DESC;

-- Also check if there are any update issues
SELECT 
  id,
  status,
  sales_signal,
  updated_at,
  created_at,
  (updated_at = created_at) as never_updated
FROM sales_forecasts
ORDER BY created_at DESC;
