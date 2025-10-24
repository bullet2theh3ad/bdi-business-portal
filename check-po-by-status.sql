-- 5. Check PO breakdown by status
SELECT 
  po_status,
  COUNT(*) as count,
  SUM(total_amount) as total_amount
FROM quickbooks_purchase_orders_qb
GROUP BY po_status
ORDER BY count DESC;

