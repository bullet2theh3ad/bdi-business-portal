-- Check ALL transaction types for MG8702-30-1 in October
SELECT 
  transaction_type,
  COUNT(*) as line_items,
  SUM(quantity) as total_units
FROM amazon_financial_line_items
WHERE bdi_sku = 'MG8702-30-1'
  AND posted_date >= '2024-10-01'
  AND posted_date < '2024-11-01'
GROUP BY transaction_type;

