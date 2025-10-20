-- Check Amazon Financial Transactions Sync Progress

-- 1. Check sync status
SELECT 
  id,
  sync_status,
  sync_type,
  period_start,
  period_end,
  days_synced,
  transactions_fetched,
  transactions_stored,
  skus_processed,
  sync_started_at,
  sync_completed_at,
  duration_seconds,
  error_message
FROM amazon_financial_transaction_syncs
ORDER BY sync_started_at DESC
LIMIT 3;

-- 2. Check if transactions are being stored
SELECT COUNT(*) as transaction_count
FROM amazon_financial_transactions;

-- 3. Check unique SKUs in transactions
SELECT COUNT(DISTINCT sku) as unique_skus
FROM amazon_financial_transactions;

-- 4. Sample of transactions (if any)
SELECT 
  id,
  order_id,
  posted_date,
  transaction_type,
  sku,
  quantity,
  net_revenue,
  created_at
FROM amazon_financial_transactions
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check by SKU
SELECT 
  sku,
  COUNT(*) as transaction_count,
  SUM(quantity) as total_units,
  SUM(net_revenue) as total_revenue
FROM amazon_financial_transactions
GROUP BY sku
ORDER BY total_revenue DESC
LIMIT 10;

