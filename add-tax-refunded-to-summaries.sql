-- Add total_tax_refunded column to amazon_financial_summaries table
ALTER TABLE amazon_financial_summaries 
ADD COLUMN IF NOT EXISTS total_tax_refunded NUMERIC(10, 2) DEFAULT 0;

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'amazon_financial_summaries'
  AND column_name = 'total_tax_refunded';

