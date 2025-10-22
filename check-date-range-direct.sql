-- Check what the date range API should be returning
SELECT 
  MIN(posted_date) as earliest_date_raw,
  MAX(posted_date) as latest_date_raw,
  DATE(MIN(posted_date)) as earliest_date,
  DATE(MAX(posted_date)) as latest_date,
  COUNT(*) as total_records
FROM amazon_financial_line_items;

-- Check if we have Oct 22 data
SELECT 
  DATE(posted_date) as date,
  COUNT(*) as record_count
FROM amazon_financial_line_items
WHERE DATE(posted_date) >= '2025-10-20'
GROUP BY DATE(posted_date)
ORDER BY DATE(posted_date) DESC;

