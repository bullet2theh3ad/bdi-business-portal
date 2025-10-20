-- Check what ad spend data is available in amazon_financial_summaries

-- 1. Show all summaries with ad spend data
SELECT 
  date_range_start::date,
  date_range_end::date,
  (date_range_end::date - date_range_start::date) as days_in_range,
  total_ad_spend,
  total_revenue,
  adjustment_credits,
  adjustment_debits,
  unique_orders,
  created_at
FROM amazon_financial_summaries
WHERE total_ad_spend IS NOT NULL OR total_ad_spend != '0'
ORDER BY date_range_start DESC;

-- 2. Summary stats
SELECT 
  COUNT(*) as total_summaries,
  COUNT(CASE WHEN total_ad_spend::numeric > 0 THEN 1 END) as summaries_with_ad_spend,
  MIN(date_range_start::date) as earliest_summary,
  MAX(date_range_end::date) as latest_summary,
  SUM(total_ad_spend::numeric) as total_ad_spend_all_summaries
FROM amazon_financial_summaries;

-- 3. Check for gaps in coverage
SELECT 
  date_range_start::date,
  date_range_end::date,
  (date_range_end::date - date_range_start::date) as days,
  total_ad_spend,
  CASE 
    WHEN total_ad_spend::numeric > 0 THEN '✅ Has ad spend'
    ELSE '⚠️ No ad spend'
  END as status
FROM amazon_financial_summaries
ORDER BY date_range_start;

