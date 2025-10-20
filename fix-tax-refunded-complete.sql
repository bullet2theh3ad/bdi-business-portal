-- Step 1: Add total_tax_refunded column to amazon_financial_summaries table
ALTER TABLE amazon_financial_summaries 
ADD COLUMN IF NOT EXISTS total_tax_refunded NUMERIC(10, 2) DEFAULT 0;

-- Step 2: Delete all existing summaries (they will be recreated with correct tax data)
-- This is safe because:
-- - Line items remain intact
-- - Backfill will recreate summaries with correct data
-- - Takes ~3 minutes to backfill all data
DELETE FROM amazon_financial_summaries;

-- Step 3: Verify
SELECT 
  COUNT(*) as summaries_deleted,
  'Run backfill button now' as next_step
FROM amazon_financial_summaries;

-- After running this SQL:
-- 1. Go to Amazon Financial Data page
-- 2. Click "Backfill Ad Spend" button
-- 3. Wait for completion (~3 minutes)
-- 4. Click "All Data" button
-- 5. Tax Refunded should now show correct amount! ✅

