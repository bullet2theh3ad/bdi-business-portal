-- Daily breakdown for MG8702-30-1 from Oct 6-13
SELECT 
  DATE(posted_date) as sale_date,
  TO_CHAR(posted_date, 'IYYY-IW') as week_key,
  COUNT(*) as line_items,
  SUM(quantity) as total_units,
  SUM(item_price::numeric) as total_revenue
FROM amazon_financial_line_items
WHERE bdi_sku = 'MG8702-30-1'
  AND posted_date >= '2024-10-06'
  AND posted_date <= '2024-10-13'
  AND transaction_type = 'sale'
GROUP BY DATE(posted_date), TO_CHAR(posted_date, 'IYYY-IW')
ORDER BY sale_date;

