-- Disconnect QuickBooks by clearing all connection records
-- This will force a fresh OAuth connection

-- Delete all existing connections
DELETE FROM quickbooks_connections;

-- Verify cleanup
SELECT 
  'quickbooks_connections' as table_name,
  COUNT(*) as remaining_records 
FROM quickbooks_connections;

