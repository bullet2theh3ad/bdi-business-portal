-- Find the Q15 SKU ID
SELECT id, sku, name 
FROM product_skus 
WHERE sku ILIKE '%Q15%' OR name ILIKE '%Q15%';

-- Find the shipment we were working with
SELECT 
  s.id as shipment_id,
  s.shipment_number,
  s.forecast_id,
  s.status,
  s.created_at
FROM shipments s
WHERE s.shipment_number = 'BDI-2025-875642';

-- Get all forecasts linked to this shipment (via forecast_id)
SELECT 
  sf.id as forecast_id,
  sf.sku_id,
  sf.quantity,
  sf.delivery_week,
  sf.created_at,
  ps.sku as product_sku,
  ps.name as product_name
FROM sales_forecasts sf
LEFT JOIN product_skus ps ON sf.sku_id = ps.id
WHERE sf.id = (
  SELECT forecast_id::uuid 
  FROM shipments 
  WHERE shipment_number = 'BDI-2025-875642'
);

-- Check if there are multiple forecasts with the same SKU as this shipment
SELECT 
  sf.id as forecast_id,
  sf.sku_id,
  sf.quantity,
  sf.delivery_week,
  sf.created_at,
  ps.sku as product_sku,
  ps.name as product_name
FROM sales_forecasts sf
LEFT JOIN product_skus ps ON sf.sku_id = ps.id
WHERE sf.sku_id = (
  SELECT sku_id 
  FROM sales_forecasts 
  WHERE id = (
    SELECT forecast_id::uuid 
    FROM shipments 
    WHERE shipment_number = 'BDI-2025-875642'
  )
)
ORDER BY sf.created_at DESC;

-- Check if any shipments reference these forecasts
SELECT 
  s.id as shipment_id,
  s.shipment_number,
  s.forecast_id,
  sf.quantity as forecast_quantity,
  sf.delivery_week
FROM shipments s
LEFT JOIN sales_forecasts sf ON s.forecast_id::uuid = sf.id
WHERE s.forecast_id::uuid IN (
  SELECT id 
  FROM sales_forecasts 
  WHERE sku_id = (
    SELECT sku_id 
    FROM sales_forecasts 
    WHERE id = (
      SELECT forecast_id::uuid 
      FROM shipments 
      WHERE shipment_number = 'BDI-2025-875642'
    )
  )
);

-- Check the sales_forecasts table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_forecasts'
ORDER BY ordinal_position;

