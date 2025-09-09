-- DEBUG: Check what shipments actually exist in the database
-- This will help us understand why MTN sees "Create" instead of "Edit"

-- 1. Check all shipments in the database
SELECT 
  'ALL SHIPMENTS' as status,
  s.id,
  s.forecast_id,
  s.jjolm_number,
  s.shipping_organization_code,
  s.status as shipment_status,
  sf.id as forecast_id_check,
  sf.status as forecast_status,
  sk.sku as sku_code,
  sk.name as sku_name
FROM shipments s
LEFT JOIN sales_forecasts sf ON s.forecast_id = sf.id
LEFT JOIN skus sk ON sf.sku_id = sk.id
ORDER BY s.created_at DESC;

-- 2. Check forecasts that MTN should see (from logs)
SELECT 
  'MTN FORECASTS' as status,
  sf.id,
  sf.status,
  sf.sales_signal,
  sf.factory_signal,
  sk.sku as sku_code,
  sk.name as sku_name,
  sf.delivery_week,
  sf.quantity
FROM sales_forecasts sf
JOIN skus sk ON sf.sku_id = sk.id
WHERE sf.id IN (
  'b46aaae0-93eb-4144-b399-0c48e824c5c0',
  'c7de7309-9e51-4dff-8077-1deaef7245ff'
)
ORDER BY sf.created_at;

-- 3. Check if there are shipments for these specific forecasts
SELECT 
  'SHIPMENTS FOR MTN FORECASTS' as status,
  s.id,
  s.forecast_id,
  s.jjolm_number,
  s.shipping_organization_code,
  s.status as shipment_status,
  sf.status as forecast_status,
  sk.sku as sku_code
FROM shipments s
JOIN sales_forecasts sf ON s.forecast_id = sf.id
JOIN skus sk ON sf.sku_id = sk.id
WHERE s.forecast_id IN (
  'b46aaae0-93eb-4144-b399-0c48e824c5c0',
  'c7de7309-9e51-4dff-8077-1deaef7245ff'
);

-- 4. Check what SKUs MTN can see via invoices
SELECT 
  'MTN INVOICE SKUS' as status,
  ili.sku_id,
  sk.sku as sku_code,
  sk.name as sku_name,
  i.customer_name
FROM invoice_line_items ili
JOIN invoices i ON ili.invoice_id = i.id
JOIN skus sk ON ili.sku_id = sk.id
WHERE i.customer_name = 'MTN'
ORDER BY sk.sku;
