-- 6. Check the full_data JSONB for one PO to see what fields are available
SELECT 
  doc_number,
  vendor_name,
  jsonb_pretty(full_data) as full_po_data
FROM quickbooks_purchase_orders_qb
ORDER BY txn_date DESC
LIMIT 1;

