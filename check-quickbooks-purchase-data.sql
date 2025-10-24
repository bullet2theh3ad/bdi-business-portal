-- Check QuickBooks Purchase-related data

-- 1. Check Purchase Orders (POs)
SELECT 
  'Purchase Orders' as entity_type,
  COUNT(*) as total_count,
  COUNT(DISTINCT vendor_name) as unique_vendors,
  MIN(txn_date) as earliest_date,
  MAX(txn_date) as latest_date,
  SUM(total_amount) as total_amount
FROM quickbooks_purchase_orders_qb;

-- 2. Check Purchase transactions (checks, credit cards, etc.)
SELECT 
  'Purchase Transactions' as entity_type,
  COUNT(*) as total_count,
  COUNT(DISTINCT vendor_name) as unique_vendors,
  MIN(expense_date) as earliest_date,
  MAX(expense_date) as latest_date,
  SUM(total_amount) as total_amount
FROM quickbooks_expenses;

-- 3. Check Bills (vendor invoices)
SELECT 
  'Bills' as entity_type,
  COUNT(*) as total_count,
  COUNT(DISTINCT vendor_name) as unique_vendors,
  MIN(bill_date) as earliest_date,
  MAX(bill_date) as latest_date,
  SUM(total_amount) as total_amount
FROM quickbooks_bills;

-- 4. Sample of Purchase Orders with details
SELECT 
  doc_number,
  vendor_name,
  txn_date,
  total_amount,
  po_status,
  ship_date,
  qb_created_at,
  qb_updated_at
FROM quickbooks_purchase_orders_qb
ORDER BY txn_date DESC
LIMIT 10;

-- 5. Check if there are any PO status filters we might be missing
SELECT 
  po_status,
  COUNT(*) as count,
  SUM(total_amount) as total_amount
FROM quickbooks_purchase_orders_qb
GROUP BY po_status
ORDER BY count DESC;

-- 6. Check the full_data JSONB for one PO to see what fields are available
SELECT 
  doc_number,
  vendor_name,
  jsonb_pretty(full_data) as full_po_data
FROM quickbooks_purchase_orders_qb
ORDER BY txn_date DESC
LIMIT 1;

