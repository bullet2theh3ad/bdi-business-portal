-- =====================================================
-- Clean All QuickBooks Data Before Real Sync
-- =====================================================
-- This script deletes all QuickBooks data to prepare for a fresh sync
-- Safe to run multiple times (idempotent)
-- =====================================================

-- 1. Delete all QuickBooks entity data (cascades due to foreign keys)
DELETE FROM quickbooks_customers;
DELETE FROM quickbooks_invoices;
DELETE FROM quickbooks_vendors;
DELETE FROM quickbooks_expenses;
DELETE FROM quickbooks_items;
DELETE FROM quickbooks_payments;
DELETE FROM quickbooks_bills;
DELETE FROM quickbooks_sales_receipts;
DELETE FROM quickbooks_credit_memos;
DELETE FROM quickbooks_purchase_orders_qb;

-- 2. Delete sync logs
DELETE FROM quickbooks_sync_log;

-- 3. (Optional) Disconnect the connection if you want to start completely fresh
-- Uncomment the next line if you want to remove the connection too:
-- DELETE FROM quickbooks_connections;

-- 4. Verify cleanup
SELECT 'Customers' as table_name, COUNT(*) as remaining_records FROM quickbooks_customers
UNION ALL
SELECT 'Invoices', COUNT(*) FROM quickbooks_invoices
UNION ALL
SELECT 'Vendors', COUNT(*) FROM quickbooks_vendors
UNION ALL
SELECT 'Expenses', COUNT(*) FROM quickbooks_expenses
UNION ALL
SELECT 'Items', COUNT(*) FROM quickbooks_items
UNION ALL
SELECT 'Payments', COUNT(*) FROM quickbooks_payments
UNION ALL
SELECT 'Bills', COUNT(*) FROM quickbooks_bills
UNION ALL
SELECT 'Sales Receipts', COUNT(*) FROM quickbooks_sales_receipts
UNION ALL
SELECT 'Credit Memos', COUNT(*) FROM quickbooks_credit_memos
UNION ALL
SELECT 'Purchase Orders', COUNT(*) FROM quickbooks_purchase_orders_qb
UNION ALL
SELECT 'Sync Logs', COUNT(*) FROM quickbooks_sync_log
UNION ALL
SELECT 'Connections', COUNT(*) FROM quickbooks_connections;

-- Expected result: All tables should show 0 records except connections (should be 1 if you didn't delete it)

