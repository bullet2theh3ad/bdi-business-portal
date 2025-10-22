-- Compare the two Amazon transaction tables
-- amazon_financial_transactions (NEW sync table)
-- amazon_financial_line_items (LEGACY display table)

-- 1. Compare record counts
SELECT 
  'amazon_financial_transactions (NEW)' as table_name,
  COUNT(*) as total_records,
  MIN(posted_date) as earliest,
  MAX(posted_date) as latest
FROM amazon_financial_transactions
UNION ALL
SELECT 
  'amazon_financial_line_items (LEGACY)' as table_name,
  COUNT(*) as total_records,
  MIN(posted_date) as earliest,
  MAX(posted_date) as latest
FROM amazon_financial_line_items;

-- 2. Check today's data in BOTH tables
SELECT 
  'amazon_financial_transactions (NEW)' as table_name,
  COUNT(*) as todays_records,
  MIN(posted_date) as earliest_today,
  MAX(posted_date) as latest_today
FROM amazon_financial_transactions
WHERE DATE(posted_date) = CURRENT_DATE
UNION ALL
SELECT 
  'amazon_financial_line_items (LEGACY)' as table_name,
  COUNT(*) as todays_records,
  MIN(posted_date) as earliest_today,
  MAX(posted_date) as latest_today
FROM amazon_financial_line_items
WHERE DATE(posted_date) = CURRENT_DATE;

-- 3. Most recent records from NEW sync table
SELECT 
  'NEW SYNC TABLE' as source,
  order_id,
  TO_CHAR(posted_date, 'YYYY-MM-DD HH24:MI:SS') as posted_datetime,
  sku,
  quantity,
  transaction_type
FROM amazon_financial_transactions
ORDER BY posted_date DESC
LIMIT 10;

-- 4. Most recent records from LEGACY display table
SELECT 
  'LEGACY DISPLAY TABLE' as source,
  order_id,
  TO_CHAR(posted_date, 'YYYY-MM-DD HH24:MI:SS') as posted_datetime,
  bdi_sku,
  quantity,
  transaction_type
FROM amazon_financial_line_items
ORDER BY posted_date DESC
LIMIT 10;

-- 5. Find records in NEW table that are NOT in LEGACY table (should be 0 after migration)
SELECT 
  COUNT(*) as records_not_migrated
FROM amazon_financial_transactions t
LEFT JOIN amazon_financial_line_items l 
  ON t.order_id = l.order_id 
  AND DATE(t.posted_date) = DATE(l.posted_date)
  AND t.sku = l.bdi_sku
WHERE l.order_id IS NULL;

