-- Verify that revenue totals match between Sales Velocity and Financial Data
-- for MG8702-30-1 in Week 41 (Oct 6-12, 2025)

-- Sales Velocity calculation (what we're using now)
SELECT 
  'Sales Velocity Method' as method,
  COUNT(DISTINCT order_id) as units,
  SUM(item_price::numeric) as gross_revenue,
  SUM(net_revenue::numeric) as net_revenue,
  SUM(commission::numeric + fba_fees::numeric + other_fees::numeric) as total_fees
FROM amazon_financial_line_items
WHERE posted_date >= '2025-10-06'
  AND posted_date <= '2025-10-12'
  AND bdi_sku = 'MG8702-30-1'
  AND transaction_type = 'sale'
  AND quantity > 0;

-- Also check: are there multiple line items with DIFFERENT item_price values for the same order?
SELECT 
  order_id,
  COUNT(*) as line_items,
  COUNT(DISTINCT item_price) as unique_prices,
  SUM(item_price::numeric) as total_item_price,
  SUM(net_revenue::numeric) as total_net_revenue
FROM amazon_financial_line_items
WHERE posted_date >= '2025-10-06'
  AND posted_date <= '2025-10-12'
  AND bdi_sku = 'MG8702-30-1'
  AND transaction_type = 'sale'
GROUP BY order_id
HAVING COUNT(*) > 1
LIMIT 5;

