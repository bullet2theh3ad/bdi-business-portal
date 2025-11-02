-- ==========================================
-- Simple QuickBooks Data Check
-- ==========================================

-- Check if QuickBooks tables have data
SELECT 
    'quickbooks_connections' as table_name,
    COUNT(*) as total_records
FROM quickbooks_connections;

SELECT 
    'quickbooks_accounts' as table_name,
    COUNT(*) as total_records
FROM quickbooks_accounts;

SELECT 
    'quickbooks_terms' as table_name,
    COUNT(*) as total_records
FROM quickbooks_terms;

SELECT 
    'quickbooks_classes' as table_name,
    COUNT(*) as total_records
FROM quickbooks_classes;

-- Show 5 sample accounts
SELECT 
    qb_account_id,
    name,
    fully_qualified_name,
    account_type
FROM quickbooks_accounts
LIMIT 5;

