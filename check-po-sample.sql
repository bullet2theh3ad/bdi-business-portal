-- 4. Sample of Purchase Orders with details (10 most recent)
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

