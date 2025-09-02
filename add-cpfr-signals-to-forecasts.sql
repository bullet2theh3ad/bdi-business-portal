-- Add CPFR Signal columns to sales_forecasts table
-- Run this in Supabase SQL Editor

-- Add the three CPFR signal columns
ALTER TABLE sales_forecasts 
ADD COLUMN IF NOT EXISTS sales_signal VARCHAR(20) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS factory_signal VARCHAR(20) DEFAULT 'unknown', 
ADD COLUMN IF NOT EXISTS shipping_signal VARCHAR(20) DEFAULT 'unknown';

-- Add comments for documentation
COMMENT ON COLUMN sales_forecasts.sales_signal IS 'Sales team forecast status: unknown, submitted, accepted, rejected';
COMMENT ON COLUMN sales_forecasts.factory_signal IS 'Factory/ODM production status: unknown, awaiting, accepted, rejected';
COMMENT ON COLUMN sales_forecasts.shipping_signal IS 'Shipping/logistics status: unknown, awaiting, accepted, rejected';

-- Create indexes for CPFR signal queries
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_sales_signal ON sales_forecasts(sales_signal);
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_factory_signal ON sales_forecasts(factory_signal);
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_shipping_signal ON sales_forecasts(shipping_signal);

-- Grant permissions (if needed)
GRANT SELECT, INSERT, UPDATE ON sales_forecasts TO authenticated;

-- Verify the columns were added
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'sales_forecasts' 
  AND column_name IN ('sales_signal', 'factory_signal', 'shipping_signal')
ORDER BY column_name;

-- Show updated table structure with new signal columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'sales_forecasts'
ORDER BY ordinal_position;
