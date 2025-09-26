-- Analyze forecast delivery timeline data to understand why 2026 forecasts aren't showing
-- Check date ranges, delivery weeks, and data distribution

-- 1. Check all forecasts and their delivery weeks (ordered by delivery week)
SELECT 
  delivery_week,
  COUNT(*) as forecast_count,
  SUM(quantity) as total_units,
  status,
  STRING_AGG(DISTINCT sku.sku, ', ') as skus_in_week
FROM sales_forecasts sf
LEFT JOIN product_skus sku ON sf.sku_id = sku.id
WHERE delivery_week IS NOT NULL
GROUP BY delivery_week, status
ORDER BY delivery_week ASC;

-- 2. Check date range coverage - what's the full span of forecasts?
SELECT 
  'Forecast Date Range Analysis' as analysis_type,
  MIN(delivery_week) as earliest_delivery_week,
  MAX(delivery_week) as latest_delivery_week,
  COUNT(*) as total_forecasts,
  COUNT(DISTINCT delivery_week) as unique_weeks_with_forecasts,
  COUNT(CASE WHEN delivery_week LIKE '2025%' THEN 1 END) as forecasts_2025,
  COUNT(CASE WHEN delivery_week LIKE '2026%' THEN 1 END) as forecasts_2026,
  COUNT(CASE WHEN delivery_week LIKE '2027%' THEN 1 END) as forecasts_2027
FROM sales_forecasts
WHERE delivery_week IS NOT NULL;

-- 3. Focus on 2026 forecasts specifically - what weeks do we have?
SELECT 
  delivery_week,
  COUNT(*) as forecast_count,
  SUM(quantity) as total_units,
  status,
  forecast_type,
  confidence,
  STRING_AGG(DISTINCT sku.sku, ', ') as skus
FROM sales_forecasts sf
LEFT JOIN product_skus sku ON sf.sku_id = sku.id
WHERE delivery_week LIKE '2026%'
GROUP BY delivery_week, status, forecast_type, confidence
ORDER BY delivery_week ASC;

-- 4. Check if there are forecasts beyond W01 2026
SELECT 
  'Beyond W01 2026' as check_type,
  COUNT(*) as forecasts_after_w01_2026,
  MIN(delivery_week) as first_week_after_w01,
  MAX(delivery_week) as last_week_after_w01,
  SUM(quantity) as total_units_after_w01
FROM sales_forecasts
WHERE delivery_week > '2026-W01'
  AND delivery_week IS NOT NULL;

-- 5. Sample of 2026 forecasts to see the data
SELECT 
  sf.id,
  sf.delivery_week,
  sf.quantity,
  sf.status,
  sf.forecast_type,
  sku.sku,
  sku.name as sku_name,
  sf.created_at,
  o.code as org_code
FROM sales_forecasts sf
LEFT JOIN product_skus sku ON sf.sku_id = sku.id
LEFT JOIN users u ON sf.created_by = u.auth_id
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE sf.delivery_week LIKE '2026%'
ORDER BY sf.delivery_week ASC, sf.created_at DESC
LIMIT 20;

-- 6. Check for any date parsing issues or invalid delivery weeks
SELECT 
  delivery_week,
  COUNT(*) as count,
  'Potential Date Issues' as issue_type
FROM sales_forecasts
WHERE delivery_week IS NOT NULL
  AND (
    delivery_week !~ '^\d{4}-W\d{2}$'  -- Not in YYYY-WNN format
    OR delivery_week LIKE '%W00%'      -- Invalid week 00
    OR delivery_week LIKE '%W5%'       -- Week > 52
  )
GROUP BY delivery_week
ORDER BY delivery_week;
