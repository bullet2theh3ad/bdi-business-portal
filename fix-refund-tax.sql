-- Delete all existing summaries so backfill will re-fetch with correct tax
-- This is safe because the backfill will recreate them with correct data
DELETE FROM amazon_financial_summaries;

-- Verify deletion
SELECT COUNT(*) as remaining_summaries FROM amazon_financial_summaries;

