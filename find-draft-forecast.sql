-- Find the specific forecast that's still in draft status
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
  sf.updated_at,
  (sf.updated_at > sf.created_at) as was_ever_updated
FROM sales_forecasts sf
LEFT JOIN product_skus ps ON ps.id = sf.sku_id
WHERE sf.status = 'draft'
ORDER BY sf.created_at DESC;

-- Also show all forecasts for comparison
SELECT 
  sf.id,
  ps.sku as sku_code,
  sf.delivery_week,
  sf.quantity,
  sf.status,
  sf.sales_signal,
  CASE 
    WHEN sf.status = 'draft' THEN '🟠 DRAFT (This one is causing orange bar)'
    WHEN sf.status = 'submitted' THEN '🔵 SUBMITTED (These should be blue bars)'
    ELSE '❓ UNKNOWN'
  END as dashboard_color
FROM sales_forecasts sf
LEFT JOIN product_skus ps ON ps.id = sf.sku_id
ORDER BY sf.status, sf.created_at;
