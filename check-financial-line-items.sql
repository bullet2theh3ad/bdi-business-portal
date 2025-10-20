-- Check if data exists in amazon_financial_line_items
SELECT 
  COUNT(*) as total_records,
  MIN(posted_date) as earliest_date,
  MAX(posted_date) as latest_date,
  COUNT(DISTINCT amazon_sku) as unique_skus,
  SUM(CASE WHEN transaction_type = 'sale' THEN 1 ELSE 0 END) as sales_count,
  SUM(CASE WHEN transaction_type = 'refund' THEN 1 ELSE 0 END) as refunds_count,
  SUM(gross_revenue::numeric) as total_gross_revenue,
  SUM(net_revenue::numeric) as total_net_revenue,
  SUM(total_fees::numeric) as total_fees,
  SUM(total_tax::numeric) as total_tax
FROM amazon_financial_line_items
WHERE posted_date >= '2024-08-21' 
  AND posted_date <= '2024-12-31';

-- Sample of actual records
SELECT 
  posted_date,
  transaction_type,
  amazon_sku,
  bdi_sku,
  quantity,
  gross_revenue,
  net_revenue,
  total_fees,
  total_tax
FROM amazon_financial_line_items
WHERE posted_date >= '2024-08-21' 
  AND posted_date <= '2024-12-31'
ORDER BY posted_date DESC
LIMIT 10;
