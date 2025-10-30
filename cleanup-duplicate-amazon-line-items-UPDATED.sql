-- =========================================================================
-- Cleanup Duplicate Amazon Financial Line Items (UPDATED)
-- This removes duplicate records keeping only one per: order_id + amazon_sku + posted_date
-- 
-- NOTE: Uses amazon_sku (not bdi_sku) to match the deduplication logic in the API
-- =========================================================================

-- =====================================================
-- Step 1: Check how many duplicates we have
-- =====================================================
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT (order_id, amazon_sku, posted_date)) as unique_records,
  COUNT(*) - COUNT(DISTINCT (order_id, amazon_sku, posted_date)) as duplicate_count
FROM amazon_financial_line_items;

-- =====================================================
-- Step 2: See example duplicates (Top 20)
-- =====================================================
SELECT 
  order_id,
  amazon_sku,
  TO_CHAR(posted_date, 'YYYY-MM-DD HH24:MI:SS') as posted_datetime,
  COUNT(*) as duplicate_count
FROM amazon_financial_line_items
GROUP BY order_id, amazon_sku, posted_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, posted_date DESC
LIMIT 20;

-- =====================================================
-- Step 3: Show a specific duplicate example for September
-- =====================================================
SELECT 
  order_id,
  amazon_sku,
  bdi_sku,
  TO_CHAR(posted_date, 'YYYY-MM-DD HH24:MI:SS') as posted_datetime,
  quantity,
  item_price,
  gross_revenue,
  total_fees
FROM amazon_financial_line_items
WHERE posted_date >= '2025-09-01' AND posted_date < '2025-10-01'
ORDER BY order_id, amazon_sku, posted_date
LIMIT 50;

-- =====================================================
-- Step 4: Create temporary table with deduplicated records
-- Uses: order_id + amazon_sku + posted_date as unique key
-- Strategy: Keep the first record (by id) for each unique combination
-- =====================================================
CREATE TEMP TABLE deduplicated_line_items AS
SELECT DISTINCT ON (order_id, amazon_sku, posted_date)
  id,
  order_id,
  posted_date,
  transaction_type,
  amazon_sku,
  asin,
  bdi_sku,
  product_name,
  quantity,
  unit_price,
  item_price,
  shipping_price,
  gift_wrap_price,
  item_promotion,
  shipping_promotion,
  item_tax,
  shipping_tax,
  gift_wrap_tax,
  commission,
  fba_fees,
  other_fees,
  total_fees,
  gross_revenue,
  net_revenue,
  total_tax,
  marketplace_id,
  currency_code,
  raw_event,
  created_at,
  updated_at
FROM amazon_financial_line_items
ORDER BY order_id, amazon_sku, posted_date, id;

-- =====================================================
-- Step 5: Verify the deduplicated count
-- =====================================================
SELECT 
  COUNT(*) as deduplicated_count,
  (SELECT COUNT(*) FROM amazon_financial_line_items) as original_count,
  (SELECT COUNT(*) FROM amazon_financial_line_items) - COUNT(*) as records_to_remove
FROM deduplicated_line_items;

-- =====================================================
-- Step 6: DELETE duplicates (keeping only the records in our temp table)
-- CAUTION: This will permanently delete data. Make a backup first!
-- =====================================================
-- Uncomment the line below to execute the deletion:
-- DELETE FROM amazon_financial_line_items WHERE id NOT IN (SELECT id FROM deduplicated_line_items);

-- =====================================================
-- Step 7: Verify cleanup (run after deletion)
-- =====================================================
SELECT 
  COUNT(*) as total_records_after_cleanup,
  COUNT(DISTINCT (order_id, amazon_sku, posted_date)) as unique_records_after_cleanup,
  COUNT(*) - COUNT(DISTINCT (order_id, amazon_sku, posted_date)) as remaining_duplicates
FROM amazon_financial_line_items;

-- =====================================================
-- Step 8: Check September 2025 data after cleanup
-- =====================================================
SELECT 
  order_id,
  amazon_sku,
  bdi_sku,
  TO_CHAR(posted_date, 'YYYY-MM-DD') as posted_date,
  quantity,
  gross_revenue,
  total_fees
FROM amazon_financial_line_items
WHERE posted_date >= '2025-09-01' AND posted_date < '2025-10-01'
ORDER BY posted_date DESC, order_id
LIMIT 30;

-- =====================================================
-- Step 9: Summary stats by date for September 2025
-- =====================================================
SELECT 
  DATE(posted_date) as date,
  COUNT(*) as line_items,
  COUNT(DISTINCT order_id) as unique_orders,
  COUNT(DISTINCT amazon_sku) as unique_skus,
  SUM(quantity) as total_quantity,
  SUM(gross_revenue::numeric) as total_revenue
FROM amazon_financial_line_items
WHERE posted_date >= '2025-09-01' AND posted_date < '2025-10-01'
GROUP BY DATE(posted_date)
ORDER BY date;

-- =====================================================
-- CLEANUP: Drop temporary table
-- =====================================================
-- DROP TABLE IF EXISTS deduplicated_line_items;

