-- Compare totals for Week 41 (Oct 6-12, 2025) across all SKUs
-- This should match what Amazon Financial Data page shows

SELECT 
  'Week 41 Totals' as label,
  COUNT(DISTINCT order_id) as unique_orders,
  COUNT(*) as total_line_items,
  SUM(item_price::numeric) as gross_revenue,
  SUM(net_revenue::numeric) as net_revenue,
  SUM((commission::numeric + fba_fees::numeric + other_fees::numeric)) as total_fees,
  SUM(item_price::numeric) - SUM(net_revenue::numeric) as calculated_fees
FROM amazon_financial_line_items
WHERE posted_date >= '2025-10-06'
  AND posted_date <= '2025-10-12'
  AND transaction_type = 'sale'
  AND bdi_sku IS NOT NULL;

-- Also show per-SKU breakdown for top 3 SKUs
SELECT 
  bdi_sku,
  COUNT(DISTINCT order_id) as units,
  SUM(item_price::numeric) as gross_revenue,
  SUM(net_revenue::numeric) as net_revenue,
  SUM(item_price::numeric) - SUM(net_revenue::numeric) as fees
FROM amazon_financial_line_items
WHERE posted_date >= '2025-10-06'
  AND posted_date <= '2025-10-12'
  AND transaction_type = 'sale'
  AND bdi_sku IS NOT NULL
GROUP BY bdi_sku
ORDER BY SUM(item_price::numeric) DESC
LIMIT 3;

