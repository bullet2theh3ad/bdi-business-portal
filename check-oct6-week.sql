-- Check which week Oct 6 falls into
SELECT 
  DATE '2024-10-06' as date,
  TO_CHAR(DATE '2024-10-06', 'Day') as day_name,
  TO_CHAR(DATE '2024-10-06', 'IYYY-IW') as week_key,
  EXTRACT(WEEK FROM DATE '2024-10-06') as week_number;

-- Check all dates Oct 6-12
SELECT 
  generate_series::date as date,
  TO_CHAR(generate_series, 'Day') as day_name,
  TO_CHAR(generate_series, 'IYYY-IW') as week_key,
  EXTRACT(WEEK FROM generate_series) as week_number
FROM generate_series(
  DATE '2024-10-06',
  DATE '2024-10-12',
  INTERVAL '1 day'
);

-- Get MG8702-30-1 data for both weeks 40 and 41
SELECT 
  TO_CHAR(posted_date, 'IYYY-IW') as week_key,
  DATE(posted_date) as sale_date,
  COUNT(*) as line_items,
  SUM(quantity) as total_units
FROM amazon_financial_line_items
WHERE bdi_sku = 'MG8702-30-1'
  AND posted_date >= '2024-10-06'
  AND posted_date <= '2024-10-13'
  AND transaction_type = 'sale'
GROUP BY TO_CHAR(posted_date, 'IYYY-IW'), DATE(posted_date)
ORDER BY sale_date;

