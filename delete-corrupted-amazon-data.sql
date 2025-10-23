-- =====================================================
-- Delete corrupted Amazon financial data from Aug 1, 2025 to today
-- This will clean up duplicate records created by the sync button
-- =====================================================

-- Step 1: Check what will be deleted (RUN THIS FIRST)
SELECT 
    'amazon_financial_transactions' as table_name,
    COUNT(*) as records_to_delete,
    MIN(posted_date) as earliest_date,
    MAX(posted_date) as latest_date
FROM amazon_financial_transactions
WHERE posted_date >= '2025-08-01'
  AND posted_date <= NOW();

-- Step 2: Check amazon_financial_line_items (if it exists)
SELECT 
    'amazon_financial_line_items' as table_name,
    COUNT(*) as records_to_delete,
    MIN(posted_date) as earliest_date,
    MAX(posted_date) as latest_date
FROM amazon_financial_line_items
WHERE posted_date >= '2025-08-01'
  AND posted_date <= NOW();

-- Step 3: DELETE from amazon_financial_transactions (UNCOMMENT TO RUN)
-- DELETE FROM amazon_financial_transactions
-- WHERE posted_date >= '2025-08-01'
--   AND posted_date <= NOW();

-- Step 4: DELETE from amazon_financial_line_items (UNCOMMENT TO RUN)
-- DELETE FROM amazon_financial_line_items
-- WHERE posted_date >= '2025-08-01'
--   AND posted_date <= NOW();

-- Step 5: Verify deletion
-- SELECT 
--     COUNT(*) as remaining_records,
--     MIN(posted_date) as earliest_date,
--     MAX(posted_date) as latest_date
-- FROM amazon_financial_transactions;

