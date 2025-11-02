-- ==========================================
-- QuickBooks Data Diagnostic Test
-- ==========================================

-- 1. Check if there's an active QuickBooks connection
SELECT 
    'QuickBooks Connection' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_connections,
    MAX(updated_at) as last_updated,
    MAX(last_sync_at) as last_synced
FROM quickbooks_connections;

-- 2. Check QuickBooks Accounts (Chart of Accounts)
SELECT 
    'QuickBooks Accounts' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_accounts,
    MAX(updated_at) as last_updated
FROM quickbooks_accounts;

-- Sample of accounts
SELECT 
    qb_account_id,
    name,
    fully_qualified_name,
    account_type,
    classification,
    current_balance,
    is_active
FROM quickbooks_accounts
LIMIT 5;

-- 3. Check QuickBooks Terms
SELECT 
    'QuickBooks Terms' as table_name,
    COUNT(*) as total_records
FROM quickbooks_terms;

-- 4. Check QuickBooks Classes
SELECT 
    'QuickBooks Classes' as table_name,
    COUNT(*) as total_records
FROM quickbooks_classes;

-- 5. Check GL Code Assignments
SELECT 
    'GL Code Assignments' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN category = 'opex' THEN 1 END) as opex_assignments,
    COUNT(CASE WHEN category = 'cogs' THEN 1 END) as cogs_assignments,
    COUNT(CASE WHEN category = 'inventory' THEN 1 END) as inventory_assignments,
    COUNT(CASE WHEN category = 'unassigned' THEN 1 END) as unassigned
FROM gl_code_assignments;

-- ==========================================
-- Summary: If all counts are > 0, data exists!
-- ==========================================

