-- Check ALL SKUs for Week 41 in 2025
SELECT 
  bdi_sku,
  TO_CHAR(posted_date, 'IYYY-IW') as week_key,
  COUNT(*) as line_items,
  SUM(quantity) as total_units,
  SUM(item_price::numeric) as total_revenue
FROM amazon_financial_line_items
WHERE posted_date >= '2025-10-06'
  AND posted_date <= '2025-10-12'
  AND bdi_sku IS NOT NULL
  AND transaction_type = 'sale'
  AND quantity > 0
GROUP BY bdi_sku, TO_CHAR(posted_date, 'IYYY-IW')
ORDER BY total_units DESC;

