-- Check Amazon Financial Line Items after migration
-- This shows what's actually in the table that displays on the page

-- 1. Get the date range of all data
SELECT 
  MIN(posted_date) as earliest_date,
  MAX(posted_date) as latest_date,
  COUNT(*) as total_records
FROM amazon_financial_line_items;

-- 2. Count records by date (last 7 days)
SELECT 
  DATE(posted_date) as transaction_date,
  COUNT(*) as record_count,
  COUNT(DISTINCT order_id) as unique_orders,
  SUM(quantity) as total_units
FROM amazon_financial_line_items
WHERE posted_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(posted_date)
ORDER BY DATE(posted_date) DESC;

-- 3. Show the 20 MOST RECENT transactions (should include today's data)
SELECT 
  order_id,
  posted_date,
  amazon_sku,
  bdi_sku,
  quantity,
  gross_revenue,
  transaction_type
FROM amazon_financial_line_items
ORDER BY posted_date DESC, order_id DESC
LIMIT 20;

-- 4. Check if we have today's data
SELECT 
  COUNT(*) as todays_record_count,
  COUNT(DISTINCT order_id) as todays_unique_orders,
  MIN(posted_date) as earliest_today,
  MAX(posted_date) as latest_today
FROM amazon_financial_line_items
WHERE DATE(posted_date) = CURRENT_DATE;

-- 5. Show sample of today's transactions (if any)
SELECT 
  order_id,
  TO_CHAR(posted_date, 'YYYY-MM-DD HH24:MI:SS') as posted_datetime,
  amazon_sku,
  bdi_sku,
  quantity,
  gross_revenue
FROM amazon_financial_line_items
WHERE DATE(posted_date) = CURRENT_DATE
ORDER BY posted_date DESC
LIMIT 10;

