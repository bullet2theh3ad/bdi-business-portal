-- =========================================================================
-- CLEANUP SEPTEMBER 2025 DUPLICATES - RUN THIS ENTIRE SCRIPT AT ONCE
-- =========================================================================
-- This script will:
-- 1. Show you what will be deleted (diagnostics)
-- 2. Create a backup table
-- 3. Delete duplicates
-- 4. Verify cleanup worked
-- 
-- IMPORTANT: Run this ENTIRE script in one go (select all and execute)
-- =========================================================================

-- =====================================================
-- DIAGNOSTIC: See current state
-- =====================================================
DO $$
DECLARE
  total_count INTEGER;
  unique_count INTEGER;
  dup_count INTEGER;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(DISTINCT (order_id, amazon_sku, posted_date)),
    COUNT(*) - COUNT(DISTINCT (order_id, amazon_sku, posted_date))
  INTO total_count, unique_count, dup_count
  FROM amazon_financial_line_items
  WHERE posted_date >= '2025-09-01' AND posted_date < '2025-10-01';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BEFORE CLEANUP:';
  RAISE NOTICE '  Total records: %', total_count;
  RAISE NOTICE '  Unique records: %', unique_count;
  RAISE NOTICE '  Duplicates: %', dup_count;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- STEP 1: Create backup table (SAFETY!)
-- =====================================================
DROP TABLE IF EXISTS amazon_financial_line_items_backup_sept_2025;

CREATE TABLE amazon_financial_line_items_backup_sept_2025 AS
SELECT * FROM amazon_financial_line_items
WHERE posted_date >= '2025-09-01' AND posted_date < '2025-10-01';

-- Verify backup
DO $$
DECLARE
  backup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backup_count
  FROM amazon_financial_line_items_backup_sept_2025;
  
  RAISE NOTICE '';
  RAISE NOTICE '✓ BACKUP CREATED: % records backed up to "amazon_financial_line_items_backup_sept_2025"', backup_count;
  RAISE NOTICE '';
END $$;

-- =====================================================
-- STEP 2: Create temp table with deduplicated records
-- =====================================================
DROP TABLE IF EXISTS temp_deduplicated CASCADE;

CREATE TEMP TABLE temp_deduplicated AS
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
WHERE posted_date >= '2025-09-01' AND posted_date < '2025-10-01'
ORDER BY order_id, amazon_sku, posted_date, id;

-- =====================================================
-- STEP 3: DELETE DUPLICATES (September only)
-- =====================================================
DELETE FROM amazon_financial_line_items 
WHERE posted_date >= '2025-09-01' 
  AND posted_date < '2025-10-01'
  AND id NOT IN (SELECT id FROM temp_deduplicated);

-- =====================================================
-- STEP 4: Verify cleanup worked
-- =====================================================
DO $$
DECLARE
  total_count INTEGER;
  unique_count INTEGER;
  dup_count INTEGER;
  revenue_before NUMERIC;
  revenue_after NUMERIC;
BEGIN
  -- Check September data after cleanup
  SELECT 
    COUNT(*),
    COUNT(DISTINCT (order_id, amazon_sku, posted_date)),
    COUNT(*) - COUNT(DISTINCT (order_id, amazon_sku, posted_date))
  INTO total_count, unique_count, dup_count
  FROM amazon_financial_line_items
  WHERE posted_date >= '2025-09-01' AND posted_date < '2025-10-01';
  
  -- Get revenue from backup (before)
  SELECT SUM(gross_revenue::numeric)
  INTO revenue_before
  FROM amazon_financial_line_items_backup_sept_2025
  WHERE transaction_type = 'sale';
  
  -- Get revenue now (after)
  SELECT SUM(gross_revenue::numeric)
  INTO revenue_after
  FROM amazon_financial_line_items
  WHERE posted_date >= '2025-09-01' 
    AND posted_date < '2025-10-01'
    AND transaction_type = 'sale';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AFTER CLEANUP:';
  RAISE NOTICE '  Total records: %', total_count;
  RAISE NOTICE '  Unique records: %', unique_count;
  RAISE NOTICE '  Remaining duplicates: %', dup_count;
  RAISE NOTICE '';
  RAISE NOTICE 'REVENUE CHECK:';
  RAISE NOTICE '  Before cleanup: $%', ROUND(revenue_before, 2);
  RAISE NOTICE '  After cleanup:  $%', ROUND(revenue_after, 2);
  RAISE NOTICE '  Difference:     $%', ROUND(revenue_before - revenue_after, 2);
  RAISE NOTICE '========================================';
  
  IF dup_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓✓✓ SUCCESS! All duplicates removed! ✓✓✓';
    RAISE NOTICE '';
  ELSE
    RAISE WARNING 'Still have % duplicates remaining!', dup_count;
  END IF;
END $$;

-- =====================================================
-- STEP 5: Show sample of cleaned data
-- =====================================================
SELECT 
  DATE(posted_date) as date,
  COUNT(*) as line_items,
  COUNT(DISTINCT order_id) as unique_orders,
  SUM(CASE WHEN transaction_type = 'sale' THEN gross_revenue::numeric ELSE 0 END) as sales_revenue,
  SUM(CASE WHEN transaction_type = 'refund' THEN ABS(gross_revenue::numeric) ELSE 0 END) as refund_amount
FROM amazon_financial_line_items
WHERE posted_date >= '2025-09-01' AND posted_date < '2025-10-01'
GROUP BY DATE(posted_date)
ORDER BY date;

-- =====================================================
-- STEP 6: Drop temp table (cleanup)
-- =====================================================
DROP TABLE IF EXISTS temp_deduplicated;

-- =====================================================
-- DONE!
-- =====================================================
-- The backup table "amazon_financial_line_items_backup_sept_2025" will remain
-- in your database in case you need to restore. You can drop it later with:
-- DROP TABLE amazon_financial_line_items_backup_sept_2025;
-- =====================================================

