-- Add intuit_tid column to quickbooks_sync_log table
-- This stores QuickBooks' transaction tracking ID for debugging and support

-- Add the column
ALTER TABLE quickbooks_sync_log 
ADD COLUMN IF NOT EXISTS intuit_tid TEXT;

-- Add index for lookups
CREATE INDEX IF NOT EXISTS idx_sync_log_intuit_tid 
ON quickbooks_sync_log(intuit_tid);

-- Add comment
COMMENT ON COLUMN quickbooks_sync_log.intuit_tid IS 'QuickBooks API transaction ID from response headers - used for debugging and Intuit support tickets';

-- Verify the change
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'quickbooks_sync_log'
AND column_name = 'intuit_tid';

