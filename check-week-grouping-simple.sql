-- =====================================================
-- Simple Week Grouping Check (Using PostgreSQL EXTRACT)
-- =====================================================

-- 1. Check what week each date falls into (PostgreSQL ISO week)
SELECT 
  DATE(posted_date) as sale_date,
  TO_CHAR(posted_date, 'Day') as day_name,
  EXTRACT(ISOYEAR FROM posted_date) as iso_year,
  EXTRACT(WEEK FROM posted_date) as iso_week,
  TO_CHAR(posted_date, 'IYYY-IW') as week_key,
  COUNT(*) as line_items,
  SUM(quantity) as total_units
FROM amazon_financial_line_items
WHERE posted_date >= '2024-10-06' 
  AND posted_date < '2024-10-13'
  AND bdi_sku IS NOT NULL
  AND transaction_type = 'sale'
  AND quantity > 0
GROUP BY DATE(posted_date), TO_CHAR(posted_date, 'Day'), EXTRACT(ISOYEAR FROM posted_date), EXTRACT(WEEK FROM posted_date), TO_CHAR(posted_date, 'IYYY-IW')
ORDER BY sale_date;

-- 2. Summary by ISO week for October
SELECT 
  TO_CHAR(posted_date, 'IYYY-IW') as week_key,
  MIN(DATE(posted_date)) as week_start,
  MAX(DATE(posted_date)) as week_end,
  COUNT(*) as line_items,
  SUM(quantity) as total_units,
  SUM(item_price::numeric) as total_revenue
FROM amazon_financial_line_items
WHERE posted_date >= '2024-10-01' 
  AND posted_date < '2024-10-20'
  AND bdi_sku IS NOT NULL
  AND transaction_type = 'sale'
  AND quantity > 0
GROUP BY TO_CHAR(posted_date, 'IYYY-IW')
ORDER BY week_key;

-- 3. Check for a specific SKU across multiple weeks
SELECT 
  bdi_sku,
  TO_CHAR(posted_date, 'IYYY-IW') as week_key,
  COUNT(*) as line_items,
  SUM(quantity) as total_units
FROM amazon_financial_line_items
WHERE posted_date >= '2024-10-01' 
  AND posted_date < '2024-10-20'
  AND bdi_sku = 'B12-30-1'
  AND transaction_type = 'sale'
  AND quantity > 0
GROUP BY bdi_sku, TO_CHAR(posted_date, 'IYYY-IW')
ORDER BY week_key;

