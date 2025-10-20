-- =====================================================
-- Verify Amazon Financial Transaction Tables
-- =====================================================

-- Check if tables exist
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('amazon_financial_transaction_syncs', 'amazon_financial_transactions')
ORDER BY table_name;

-- If tables exist, check their structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('amazon_financial_transaction_syncs', 'amazon_financial_transactions')
ORDER BY table_name, ordinal_position;

-- Check if any data exists
SELECT 
  'amazon_financial_transaction_syncs' as table_name,
  COUNT(*) as record_count,
  MAX(sync_completed_at) as last_sync
FROM amazon_financial_transaction_syncs
UNION ALL
SELECT 
  'amazon_financial_transactions' as table_name,
  COUNT(*) as record_count,
  MAX(posted_date) as last_transaction
FROM amazon_financial_transactions;

