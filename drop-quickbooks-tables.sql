-- =====================================================
-- Drop QuickBooks Integration Tables & Indexes
-- Run this FIRST if you need to start fresh
-- =====================================================

-- Drop tables (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS quickbooks_expenses CASCADE;
DROP TABLE IF EXISTS quickbooks_bills CASCADE;
DROP TABLE IF EXISTS quickbooks_payments CASCADE;
DROP TABLE IF EXISTS quickbooks_invoices CASCADE;
DROP TABLE IF EXISTS quickbooks_items CASCADE;
DROP TABLE IF EXISTS quickbooks_vendors CASCADE;
DROP TABLE IF EXISTS quickbooks_customers CASCADE;
DROP TABLE IF EXISTS quickbooks_sync_log CASCADE;
DROP TABLE IF EXISTS quickbooks_connections CASCADE;

-- Drop indexes (if they exist independently)
DROP INDEX IF EXISTS idx_qb_connections_realm;
DROP INDEX IF EXISTS idx_qb_connections_active;
DROP INDEX IF EXISTS idx_qb_sync_log_connection;
DROP INDEX IF EXISTS idx_qb_sync_log_type;
DROP INDEX IF EXISTS idx_qb_customers_qb_id;
DROP INDEX IF EXISTS idx_qb_customers_display_name;
DROP INDEX IF EXISTS idx_qb_invoices_qb_id;
DROP INDEX IF EXISTS idx_qb_invoices_customer;
DROP INDEX IF EXISTS idx_qb_invoices_status;
DROP INDEX IF EXISTS idx_qb_vendors_qb_id;
DROP INDEX IF EXISTS idx_qb_vendors_display_name;
DROP INDEX IF EXISTS idx_qb_expenses_vendor;
DROP INDEX IF EXISTS idx_qb_expenses_account;

-- Drop functions (if they exist)
DROP FUNCTION IF EXISTS refresh_quickbooks_token(UUID);

-- Success message
SELECT 'QuickBooks tables, indexes, and functions dropped successfully!' as status;

