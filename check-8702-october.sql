-- Check MG8702-30-1 data in October 2024
SELECT 
  DATE(posted_date) as sale_date,
  COUNT(*) as line_items,
  SUM(quantity) as total_units
FROM amazon_financial_line_items
WHERE bdi_sku = 'MG8702-30-1'
  AND posted_date >= '2024-10-01'
  AND posted_date < '2024-11-01'
  AND transaction_type = 'sale'
GROUP BY DATE(posted_date)
ORDER BY sale_date;

