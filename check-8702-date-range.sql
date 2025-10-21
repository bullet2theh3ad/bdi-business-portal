-- Check the actual date range for MG8702-30-1
SELECT 
  MIN(DATE(posted_date)) as first_sale,
  MAX(DATE(posted_date)) as last_sale,
  COUNT(*) as total_records,
  SUM(quantity) as total_units
FROM amazon_financial_line_items
WHERE bdi_sku = 'MG8702-30-1';

