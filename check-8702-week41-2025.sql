-- Check MG8702-30-1 for Week 41 in 2025 (Oct 6-12, 2025)
SELECT 
  DATE(posted_date) as sale_date,
  TO_CHAR(posted_date, 'Day') as day_name,
  TO_CHAR(posted_date, 'IYYY-IW') as week_key,
  COUNT(*) as line_items,
  SUM(quantity) as total_units,
  SUM(item_price::numeric) as total_revenue
FROM amazon_financial_line_items
WHERE bdi_sku = 'MG8702-30-1'
  AND posted_date >= '2025-10-06'
  AND posted_date <= '2025-10-12'
GROUP BY DATE(posted_date), TO_CHAR(posted_date, 'Day'), TO_CHAR(posted_date, 'IYYY-IW')
ORDER BY sale_date;

