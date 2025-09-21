-- Add comprehensive CPFR date fields to sales_forecasts table
-- This creates a complete timeline tracking system for collaborative planning

-- Step 1: Add all the CPFR timeline date fields
ALTER TABLE sales_forecasts 
ADD COLUMN IF NOT EXISTS estimated_transit_start DATE NULL,
ADD COLUMN IF NOT EXISTS estimated_warehouse_arrival DATE NULL,
ADD COLUMN IF NOT EXISTS confirmed_delivery_date DATE NULL,
ADD COLUMN IF NOT EXISTS original_delivery_date DATE NULL,
ADD COLUMN IF NOT EXISTS original_exw_date DATE NULL,
ADD COLUMN IF NOT EXISTS original_transit_start DATE NULL,
ADD COLUMN IF NOT EXISTS original_warehouse_arrival DATE NULL;

-- Step 2: Add manual override fields for cascade logic
ALTER TABLE sales_forecasts 
ADD COLUMN IF NOT EXISTS manual_factory_lead_time INTEGER NULL,
ADD COLUMN IF NOT EXISTS manual_transit_time INTEGER NULL,
ADD COLUMN IF NOT EXISTS manual_warehouse_processing INTEGER NULL,
ADD COLUMN IF NOT EXISTS manual_buffer_days INTEGER NULL;

-- Step 3: Add change tracking fields to record "was" and "is" for every change
ALTER TABLE sales_forecasts 
ADD COLUMN IF NOT EXISTS date_change_history JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS last_date_change_by UUID REFERENCES users(auth_id),
ADD COLUMN IF NOT EXISTS last_date_change_at TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS date_change_reason TEXT NULL;

-- Step 4: Add comments for documentation
COMMENT ON COLUMN sales_forecasts.estimated_transit_start IS 'Calculated start date for transit/shipping phase';
COMMENT ON COLUMN sales_forecasts.estimated_warehouse_arrival IS 'Calculated arrival date at destination warehouse';
COMMENT ON COLUMN sales_forecasts.confirmed_delivery_date IS 'Final confirmed delivery date to customer';
COMMENT ON COLUMN sales_forecasts.original_delivery_date IS 'Original planned delivery date for variance tracking';
COMMENT ON COLUMN sales_forecasts.original_exw_date IS 'Original planned EXW date for variance tracking';
COMMENT ON COLUMN sales_forecasts.original_transit_start IS 'Original planned transit start date';
COMMENT ON COLUMN sales_forecasts.original_warehouse_arrival IS 'Original planned warehouse arrival date';

COMMENT ON COLUMN sales_forecasts.manual_factory_lead_time IS 'Manual override for factory lead time in days';
COMMENT ON COLUMN sales_forecasts.manual_transit_time IS 'Manual override for transit time in days';
COMMENT ON COLUMN sales_forecasts.manual_warehouse_processing IS 'Manual override for warehouse processing time in days';
COMMENT ON COLUMN sales_forecasts.manual_buffer_days IS 'Manual override for safety buffer days';

COMMENT ON COLUMN sales_forecasts.date_change_history IS 'JSON array tracking all date changes with timestamps and reasons';
COMMENT ON COLUMN sales_forecasts.last_date_change_by IS 'User who made the most recent date change';
COMMENT ON COLUMN sales_forecasts.last_date_change_at IS 'Timestamp of most recent date change';
COMMENT ON COLUMN sales_forecasts.date_change_reason IS 'Reason for the most recent date change';

-- Step 5: Create indexes for performance on new date fields
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_estimated_transit_start ON sales_forecasts(estimated_transit_start);
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_estimated_warehouse_arrival ON sales_forecasts(estimated_warehouse_arrival);
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_confirmed_delivery_date ON sales_forecasts(confirmed_delivery_date);
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_last_date_change_at ON sales_forecasts(last_date_change_at);
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_last_date_change_by ON sales_forecasts(last_date_change_by);

-- Step 6: Grant permissions
GRANT SELECT, INSERT, UPDATE ON sales_forecasts TO authenticated;

-- Step 7: Verify all new columns were added
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'sales_forecasts' 
  AND column_name IN (
    'estimated_transit_start',
    'estimated_warehouse_arrival', 
    'confirmed_delivery_date',
    'original_delivery_date',
    'original_exw_date',
    'original_transit_start',
    'original_warehouse_arrival',
    'manual_factory_lead_time',
    'manual_transit_time',
    'manual_warehouse_processing',
    'manual_buffer_days',
    'date_change_history',
    'last_date_change_by',
    'last_date_change_at',
    'date_change_reason'
  )
ORDER BY column_name;

-- Step 8: Show sample of existing forecasts to verify structure
SELECT 
    id,
    delivery_week,
    custom_exw_date,
    estimated_transit_start,
    estimated_warehouse_arrival,
    confirmed_delivery_date,
    original_delivery_date,
    date_change_history,
    created_at
FROM sales_forecasts 
ORDER BY created_at DESC 
LIMIT 3;
