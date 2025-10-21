-- Check for duplicate line items per order for MG8702-30-1 in Week 41 2025
SELECT 
  order_id,
  posted_date,
  COUNT(*) as line_items_per_order,
  SUM(quantity) as total_quantity_per_order,
  SUM(item_price::numeric) as total_price_per_order
FROM amazon_financial_line_items
WHERE posted_date >= '2025-10-06'
  AND posted_date <= '2025-10-12'
  AND bdi_sku = 'MG8702-30-1'
  AND transaction_type = 'sale'
GROUP BY order_id, posted_date
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 20;

-- Also check total unique orders
SELECT 
  COUNT(DISTINCT order_id) as unique_orders,
  COUNT(*) as total_line_items,
  SUM(quantity) as total_units
FROM amazon_financial_line_items
WHERE posted_date >= '2025-10-06'
  AND posted_date <= '2025-10-12'
  AND bdi_sku = 'MG8702-30-1'
  AND transaction_type = 'sale';

