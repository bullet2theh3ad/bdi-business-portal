-- Verify Amazon Financial Events tables exist
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('amazon_financial_syncs', 'amazon_financial_events')
ORDER BY table_name, ordinal_position;

