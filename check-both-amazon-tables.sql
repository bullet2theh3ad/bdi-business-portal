-- Check both Amazon financial tables to see which has data

-- Check amazon_financial_line_items
SELECT 
    'amazon_financial_line_items' as table_name,
    COUNT(*) as total_records,
    MIN(posted_date) as earliest_date,
    MAX(posted_date) as latest_date
FROM amazon_financial_line_items;

-- Check amazon_financial_transactions
SELECT 
    'amazon_financial_transactions' as table_name,
    COUNT(*) as total_records,
    MIN(posted_date) as earliest_date,
    MAX(posted_date) as latest_date
FROM amazon_financial_transactions;

-- Check if there's data after Aug 1, 2025 in amazon_financial_line_items
SELECT 
    'line_items_after_aug_2025' as check_name,
    COUNT(*) as records_after_aug_2025
FROM amazon_financial_line_items
WHERE posted_date >= '2025-08-01';

-- Check if there's data after Aug 1, 2025 in amazon_financial_transactions
SELECT 
    'transactions_after_aug_2025' as check_name,
    COUNT(*) as records_after_aug_2025
FROM amazon_financial_transactions
WHERE posted_date >= '2025-08-01';

