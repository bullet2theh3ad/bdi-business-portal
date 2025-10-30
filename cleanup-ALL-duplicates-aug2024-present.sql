-- =========================================================================
-- CLEANUP ALL DUPLICATES - AUGUST 2024 TO PRESENT
-- =========================================================================
-- This script will:
-- 1. Show duplicates across all months
-- 2. Create a complete backup of affected records
-- 3. Delete ALL duplicates from Aug 2024 to present
-- 4. Verify cleanup worked
-- 
-- IMPORTANT: Run this ENTIRE script in one go (select all and execute)
-- =========================================================================

-- =====================================================
-- DIAGNOSTIC: Check all months for duplicates
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
  WHERE posted_date >= '2024-08-01';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BEFORE CLEANUP (Aug 2024 - Present):';
  RAISE NOTICE '  Total records: %', total_count;
  RAISE NOTICE '  Unique records: %', unique_count;
  RAISE NOTICE '  Duplicates: %', dup_count;
  RAISE NOTICE '========================================';
END $$;

-- Show duplicates by month
SELECT 
  TO_CHAR(posted_date, 'YYYY-MM') as month,
  COUNT(*) as total_records,
  COUNT(DISTINCT (order_id, amazon_sku, posted_date)) as unique_records,
  COUNT(*) - COUNT(DISTINCT (order_id, amazon_sku, posted_date)) as duplicates,
  ROUND(100.0 * (COUNT(*) - COUNT(DISTINCT (order_id, amazon_sku, posted_date))) / COUNT(*), 1) as dup_pct
FROM amazon_financial_line_items
WHERE posted_date >= '2024-08-01'
GROUP BY TO_CHAR(posted_date, 'YYYY-MM')
ORDER BY month DESC;

-- =====================================================
-- STEP 1: Create COMPLETE backup table (SAFETY!)
-- =====================================================
DROP TABLE IF EXISTS amazon_financial_line_items_backup_full;

CREATE TABLE amazon_financial_line_items_backup_full AS
SELECT * FROM amazon_financial_line_items
WHERE posted_date >= '2024-08-01';

-- Verify backup
DO $$
DECLARE
  backup_count INTEGER;
  min_date DATE;
  max_date DATE;
BEGIN
  SELECT 
    COUNT(*),
    MIN(posted_date::date),
    MAX(posted_date::date)
  INTO backup_count, min_date, max_date
  FROM amazon_financial_line_items_backup_full;
  
  RAISE NOTICE '';
  RAISE NOTICE '✓ BACKUP CREATED: % records backed up', backup_count;
  RAISE NOTICE '  Date range: % to %', min_date, max_date;
  RAISE NOTICE '  Table: "amazon_financial_line_items_backup_full"';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- STEP 2: Create temp table with ALL deduplicated records
-- =====================================================
DROP TABLE IF EXISTS temp_deduplicated_all CASCADE;

CREATE TEMP TABLE temp_deduplicated_all AS
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
WHERE posted_date >= '2024-08-01'
ORDER BY order_id, amazon_sku, posted_date, id;

-- Verify temp table
DO $$
DECLARE
  temp_count INTEGER;
  original_count INTEGER;
  to_delete INTEGER;
BEGIN
  SELECT COUNT(*) INTO temp_count FROM temp_deduplicated_all;
  SELECT COUNT(*) INTO original_count FROM amazon_financial_line_items WHERE posted_date >= '2024-08-01';
  to_delete := original_count - temp_count;
  
  RAISE NOTICE '✓ Deduplicated temp table created';
  RAISE NOTICE '  Will keep: % records', temp_count;
  RAISE NOTICE '  Will delete: % duplicate records', to_delete;
  RAISE NOTICE '';
END $$;

-- =====================================================
-- STEP 3: DELETE ALL DUPLICATES (Aug 2024 - Present)
-- =====================================================
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE '⚠️  Starting deletion of duplicates...';
  RAISE NOTICE '';
  
  WITH deleted AS (
    DELETE FROM amazon_financial_line_items 
    WHERE posted_date >= '2024-08-01'
      AND id NOT IN (SELECT id FROM temp_deduplicated_all)
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RAISE NOTICE '✓ DELETION COMPLETE';
  RAISE NOTICE '  Deleted: % duplicate records', deleted_count;
  RAISE NOTICE '';
END $$;

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
  -- Check data after cleanup
  SELECT 
    COUNT(*),
    COUNT(DISTINCT (order_id, amazon_sku, posted_date)),
    COUNT(*) - COUNT(DISTINCT (order_id, amazon_sku, posted_date))
  INTO total_count, unique_count, dup_count
  FROM amazon_financial_line_items
  WHERE posted_date >= '2024-08-01';
  
  -- Get revenue from backup (before)
  SELECT SUM(gross_revenue::numeric)
  INTO revenue_before
  FROM amazon_financial_line_items_backup_full
  WHERE transaction_type = 'sale';
  
  -- Get revenue now (after)
  SELECT SUM(gross_revenue::numeric)
  INTO revenue_after
  FROM amazon_financial_line_items
  WHERE posted_date >= '2024-08-01'
    AND transaction_type = 'sale';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AFTER CLEANUP:';
  RAISE NOTICE '  Total records: %', total_count;
  RAISE NOTICE '  Unique records: %', unique_count;
  RAISE NOTICE '  Remaining duplicates: %', dup_count;
  RAISE NOTICE '';
  RAISE NOTICE 'REVENUE CHECK (Sales only):';
  RAISE NOTICE '  Before cleanup: $%', ROUND(revenue_before, 2);
  RAISE NOTICE '  After cleanup:  $%', ROUND(revenue_after, 2);
  RAISE NOTICE '  Excess removed: $%', ROUND(revenue_before - revenue_after, 2);
  RAISE NOTICE '========================================';
  
  IF dup_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓✓✓ SUCCESS! All duplicates removed from entire database! ✓✓✓';
    RAISE NOTICE '';
  ELSE
    RAISE WARNING 'Still have % duplicates remaining!', dup_count;
  END IF;
END $$;

-- =====================================================
-- STEP 5: Show monthly breakdown after cleanup
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MONTHLY BREAKDOWN (After Cleanup):';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

SELECT 
  TO_CHAR(posted_date, 'YYYY-MM') as month,
  COUNT(*) as total_records,
  COUNT(DISTINCT (order_id, amazon_sku, posted_date)) as unique_records,
  COUNT(*) - COUNT(DISTINCT (order_id, amazon_sku, posted_date)) as remaining_dups,
  COUNT(DISTINCT order_id) as unique_orders,
  SUM(CASE WHEN transaction_type = 'sale' THEN gross_revenue::numeric ELSE 0 END) as sales_revenue,
  SUM(CASE WHEN transaction_type = 'refund' THEN ABS(gross_revenue::numeric) ELSE 0 END) as refund_amount
FROM amazon_financial_line_items
WHERE posted_date >= '2024-08-01'
GROUP BY TO_CHAR(posted_date, 'YYYY-MM')
ORDER BY month DESC;

-- =====================================================
-- STEP 6: Summary stats
-- =====================================================
DO $$
DECLARE
  v_total_orders INTEGER;
  v_total_sales NUMERIC;
  v_total_refunds NUMERIC;
  v_total_fees NUMERIC;
  v_net_revenue NUMERIC;
BEGIN
  SELECT 
    COUNT(DISTINCT a.order_id),
    SUM(CASE WHEN a.transaction_type = 'sale' THEN a.gross_revenue::numeric ELSE 0 END),
    SUM(CASE WHEN a.transaction_type = 'refund' THEN ABS(a.gross_revenue::numeric) ELSE 0 END),
    SUM(a.total_fees::numeric)
  INTO v_total_orders, v_total_sales, v_total_refunds, v_total_fees
  FROM amazon_financial_line_items a
  WHERE a.posted_date >= '2024-08-01';
  
  v_net_revenue := v_total_sales - v_total_fees - v_total_refunds;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'OVERALL SUMMARY (Aug 2024 - Present):';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total Unique Orders: %', v_total_orders;
  RAISE NOTICE 'Total Sales Revenue: $%', ROUND(v_total_sales, 2);
  RAISE NOTICE 'Total Refunds:       $%', ROUND(v_total_refunds, 2);
  RAISE NOTICE 'Total Fees:          $%', ROUND(v_total_fees, 2);
  RAISE NOTICE 'Net Revenue:         $%', ROUND(v_net_revenue, 2);
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- STEP 7: Drop temp table (cleanup)
-- =====================================================
DROP TABLE IF EXISTS temp_deduplicated_all;

-- =====================================================
-- DONE!
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ CLEANUP COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'The backup table "amazon_financial_line_items_backup_full" remains';
  RAISE NOTICE 'in your database for safety. You can drop it later with:';
  RAISE NOTICE '';
  RAISE NOTICE '  DROP TABLE amazon_financial_line_items_backup_full;';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Go to Admin → Amazon Data → Financial Data';
  RAISE NOTICE '  2. Export data for any month and verify no duplicates';
  RAISE NOTICE '  3. Check that revenue totals are correct';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

