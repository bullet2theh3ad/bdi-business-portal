-- Find all SKUs that contain "8702"
SELECT DISTINCT 
  bdi_sku,
  COUNT(*) as total_records,
  SUM(quantity) as total_units
FROM amazon_financial_line_items
WHERE bdi_sku LIKE '%8702%'
  AND transaction_type = 'sale'
GROUP BY bdi_sku
ORDER BY total_units DESC;

