-- =====================================================
-- Check MG8702-30-1 SKU for Week 41 (Oct 6-12, 2024)
-- =====================================================

-- 1. Daily breakdown for MG8702-30-1 in Week 41
SELECT 
  DATE(posted_date) as sale_date,
  TO_CHAR(posted_date, 'Day') as day_name,
  TO_CHAR(posted_date, 'IYYY-IW') as week_key,
  transaction_type,
  COUNT(*) as line_items,
  SUM(quantity) as total_units,
  SUM(item_price::numeric) as total_revenue
FROM amazon_financial_line_items
WHERE posted_date >= '2024-10-06' 
  AND posted_date < '2024-10-13'
  AND bdi_sku = 'MG8702-30-1'
GROUP BY DATE(posted_date), TO_CHAR(posted_date, 'Day'), TO_CHAR(posted_date, 'IYYY-IW'), transaction_type
ORDER BY sale_date, transaction_type;

-- 2. Week 41 Summary for MG8702-30-1
SELECT 
  'MG8702-30-1 Week 41' as label,
  transaction_type,
  COUNT(*) as line_items,
  SUM(quantity) as total_units,
  SUM(item_price::numeric) as total_revenue
FROM amazon_financial_line_items
WHERE posted_date >= '2024-10-06' 
  AND posted_date < '2024-10-13'
  AND bdi_sku = 'MG8702-30-1'
GROUP BY transaction_type;

-- 3. MG8702-30-1 across all October weeks
SELECT 
  TO_CHAR(posted_date, 'IYYY-IW') as week_key,
  MIN(DATE(posted_date)) as week_start,
  MAX(DATE(posted_date)) as week_end,
  transaction_type,
  COUNT(*) as line_items,
  SUM(quantity) as total_units,
  SUM(item_price::numeric) as total_revenue
FROM amazon_financial_line_items
WHERE posted_date >= '2024-10-01' 
  AND posted_date < '2024-10-20'
  AND bdi_sku = 'MG8702-30-1'
GROUP BY TO_CHAR(posted_date, 'IYYY-IW'), transaction_type
ORDER BY week_key, transaction_type;

-- 4. Check for duplicate line items for MG8702-30-1 in Week 41
SELECT 
  order_id,
  DATE(posted_date) as sale_date,
  COUNT(*) as line_items_per_order,
  SUM(quantity) as total_quantity_per_order
FROM amazon_financial_line_items
WHERE posted_date >= '2024-10-06' 
  AND posted_date < '2024-10-13'
  AND bdi_sku = 'MG8702-30-1'
  AND transaction_type = 'sale'
GROUP BY order_id, DATE(posted_date)
HAVING COUNT(*) > 1
ORDER BY line_items_per_order DESC
LIMIT 20;

