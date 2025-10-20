-- Check refund line items to see if they have tax data
SELECT 
  COUNT(*) as total_refunds,
  SUM(CASE WHEN total_tax::numeric != 0 THEN 1 ELSE 0 END) as refunds_with_tax,
  SUM(CASE WHEN total_tax::numeric = 0 THEN 1 ELSE 0 END) as refunds_without_tax,
  SUM(total_tax::numeric) as total_tax_in_db
FROM amazon_financial_line_items
WHERE transaction_type = 'refund';

-- Sample a few refund records
SELECT 
  order_id,
  posted_date,
  amazon_sku,
  quantity,
  item_price,
  total_tax,
  item_tax,
  shipping_tax
FROM amazon_financial_line_items
WHERE transaction_type = 'refund'
ORDER BY posted_date DESC
LIMIT 10;

