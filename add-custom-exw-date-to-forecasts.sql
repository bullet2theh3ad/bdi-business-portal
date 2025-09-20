-- Add custom EXW date field to sales_forecasts table
-- This will store the actual custom date selected in Forecast Lead Time Options

-- Add the new column
ALTER TABLE sales_forecasts 
ADD COLUMN custom_exw_date DATE NULL;

-- Add comment to explain the field
COMMENT ON COLUMN sales_forecasts.custom_exw_date IS 'Custom EXW (Ex Works) date selected by user in Lead Time Options. When set, this overrides calculated EXW dates for shipments.';

-- Verify the column was added
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sales_forecasts' 
AND column_name = 'custom_exw_date';

-- Show sample of existing forecasts to verify structure
SELECT 
    id,
    delivery_week,
    shipping_preference,
    custom_lead_time,
    custom_exw_date,
    created_at
FROM sales_forecasts 
ORDER BY created_at DESC 
LIMIT 5;
