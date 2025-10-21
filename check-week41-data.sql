-- =====================================================
-- Check Week 41 (Oct 6-12, 2024) Data Analysis
-- Compare what's in the database vs what Sales Velocity shows
-- =====================================================

-- 1. Daily breakdown for Week 41
SELECT 
  DATE(posted_date) as sale_date,
  bdi_sku,
  transaction_type,
  COUNT(*) as line_item_count,
  SUM(quantity) as total_quantity,
  SUM(item_price::numeric) as total_revenue
FROM amazon_financial_line_items
WHERE posted_date >= '2024-10-06' 
  AND posted_date < '2024-10-13'
  AND bdi_sku IS NOT NULL
GROUP BY DATE(posted_date), bdi_sku, transaction_type
ORDER BY sale_date, bdi_sku, transaction_type;

-- 2. Week 41 Summary by Transaction Type
SELECT 
  'Week 41 Summary' as label,
  transaction_type,
  COUNT(DISTINCT bdi_sku) as unique_skus,
  COUNT(*) as line_items,
  SUM(quantity) as total_units,
  SUM(item_price::numeric) as total_revenue
FROM amazon_financial_line_items
WHERE posted_date >= '2024-10-06' 
  AND posted_date < '2024-10-13'
  AND bdi_sku IS NOT NULL
GROUP BY transaction_type;

-- 3. Week 41 Total (Sales Only)
SELECT 
  'Week 41 SALES ONLY' as label,
  COUNT(DISTINCT bdi_sku) as unique_skus,
  COUNT(*) as line_items,
  SUM(quantity) as total_units,
  SUM(item_price::numeric) as total_revenue
FROM amazon_financial_line_items
WHERE posted_date >= '2024-10-06' 
  AND posted_date < '2024-10-13'
  AND bdi_sku IS NOT NULL
  AND transaction_type = 'sale'
  AND quantity > 0;

-- 4. Check if there are multiple line items per order
SELECT 
  order_id,
  bdi_sku,
  COUNT(*) as line_items_per_order,
  SUM(quantity) as total_quantity_per_order
FROM amazon_financial_line_items
WHERE posted_date >= '2024-10-06' 
  AND posted_date < '2024-10-13'
  AND bdi_sku IS NOT NULL
  AND transaction_type = 'sale'
GROUP BY order_id, bdi_sku
HAVING COUNT(*) > 1
ORDER BY line_items_per_order DESC
LIMIT 10;

