-- Simple sync check (run one at a time if needed)

-- 1. Latest sync status
SELECT sync_status, transactions_stored, skus_processed 
FROM amazon_financial_transaction_syncs 
ORDER BY sync_started_at DESC LIMIT 1;

-- 2. Transaction count
SELECT COUNT(*) FROM amazon_financial_transactions;

