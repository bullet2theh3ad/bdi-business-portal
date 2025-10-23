-- Show the shipment and its linked forecast
SELECT 
  s.id as shipment_id,
  s.shipment_number,
  s.forecast_id,
  s.status as shipment_status,
  sf.id as forecast_uuid,
  sf.quantity as forecast_quantity,
  sf.delivery_week,
  sf.status as forecast_status,
  ps.sku as product_sku,
  ps.name as product_name
FROM shipments s
LEFT JOIN sales_forecasts sf ON s.forecast_id::uuid = sf.id
LEFT JOIN product_skus ps ON sf.sku_id = ps.id
WHERE s.shipment_number = 'BDI-2025-875642';

-- Show ALL forecasts for the Q15 SKU
SELECT 
  sf.id as forecast_id,
  sf.quantity,
  sf.delivery_week,
  sf.status,
  sf.created_at,
  ps.sku as product_sku,
  ps.name as product_name,
  -- Check if this forecast is linked to any shipment
  (SELECT COUNT(*) FROM shipments WHERE forecast_id::uuid = sf.id) as linked_shipment_count
FROM sales_forecasts sf
LEFT JOIN product_skus ps ON sf.sku_id = ps.id
WHERE ps.sku ILIKE '%Q15%'
ORDER BY sf.created_at DESC;

-- Show ALL shipments that use forecasts for the Q15 SKU
SELECT 
  s.id as shipment_id,
  s.shipment_number,
  s.forecast_id,
  s.status as shipment_status,
  sf.quantity as forecast_quantity,
  sf.delivery_week,
  ps.sku as product_sku
FROM shipments s
LEFT JOIN sales_forecasts sf ON s.forecast_id::uuid = sf.id
LEFT JOIN product_skus ps ON sf.sku_id = ps.id
WHERE ps.sku ILIKE '%Q15%'
ORDER BY s.created_at DESC;

