-- =====================================================
-- Delete corrupted Amazon data from BOTH tables
-- Aug 1, 2025 to today
-- =====================================================

-- STEP 1: Check what will be deleted from BOTH tables
SELECT 
    'amazon_financial_line_items' as table_name,
    COUNT(*) as records_to_delete,
    MIN(posted_date) as earliest_date,
    MAX(posted_date) as latest_date
FROM amazon_financial_line_items
WHERE posted_date >= '2025-08-01'
  AND posted_date <= NOW();

SELECT 
    'amazon_financial_transactions' as table_name,
    COUNT(*) as records_to_delete,
    MIN(posted_date) as earliest_date,
    MAX(posted_date) as latest_date
FROM amazon_financial_transactions
WHERE posted_date >= '2025-08-01'
  AND posted_date <= NOW();

-- STEP 2: DELETE from amazon_financial_line_items (UNCOMMENT TO RUN)
-- DELETE FROM amazon_financial_line_items
-- WHERE posted_date >= '2025-08-01'
--   AND posted_date <= NOW();

-- STEP 3: DELETE from amazon_financial_transactions (UNCOMMENT TO RUN)
-- DELETE FROM amazon_financial_transactions
-- WHERE posted_date >= '2025-08-01'
--   AND posted_date <= NOW();

-- STEP 4: Verify both tables are clean
-- SELECT 
--     'amazon_financial_line_items' as table_name,
--     COUNT(*) as remaining_records,
--     MIN(posted_date) as earliest_date,
--     MAX(posted_date) as latest_date
-- FROM amazon_financial_line_items;

-- SELECT 
--     'amazon_financial_transactions' as table_name,
--     COUNT(*) as remaining_records,
--     MIN(posted_date) as earliest_date,
--     MAX(posted_date) as latest_date
-- FROM amazon_financial_transactions;

