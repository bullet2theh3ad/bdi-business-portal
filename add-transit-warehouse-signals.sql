-- Add separate columns for transit and warehouse signals
-- Currently both use shipping_signal which causes conflicts

-- Add the new columns
ALTER TABLE sales_forecasts 
ADD COLUMN IF NOT EXISTS transit_signal VARCHAR(20) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS warehouse_signal VARCHAR(20) DEFAULT 'unknown';

-- Add comments for documentation
COMMENT ON COLUMN sales_forecasts.transit_signal IS 'Transit/shipping status: unknown, submitted, accepted, rejected';
COMMENT ON COLUMN sales_forecasts.warehouse_signal IS 'Warehouse delivery status: unknown, submitted, accepted, rejected';

-- Create indexes for the new signal columns
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_transit_signal ON sales_forecasts(transit_signal);
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_warehouse_signal ON sales_forecasts(warehouse_signal);

-- Migrate existing shipping_signal data to both new columns (one-time migration)
-- This preserves existing data by copying shipping_signal to both new columns
UPDATE sales_forecasts 
SET transit_signal = shipping_signal,
    warehouse_signal = shipping_signal
WHERE transit_signal = 'unknown' AND warehouse_signal = 'unknown';

-- Verify the new columns exist
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'sales_forecasts' 
  AND column_name IN ('sales_signal', 'factory_signal', 'shipping_signal', 'transit_signal', 'warehouse_signal')
ORDER BY column_name;

-- Show sample data
SELECT 
  id,
  sku_id,
  status,
  sales_signal,
  factory_signal,
  shipping_signal,
  transit_signal,
  warehouse_signal,
  created_at
FROM sales_forecasts 
LIMIT 3;
