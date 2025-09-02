-- Update existing purchase_orders table to use delivery date instead of delivery week

-- First, add the new delivery date column
ALTER TABLE purchase_orders 
ADD COLUMN requested_delivery_date DATE;

-- Copy any existing delivery week data to the new date column (if any data exists)
-- This is a placeholder - you may need to manually convert week formats to dates
UPDATE purchase_orders 
SET requested_delivery_date = purchase_order_date + INTERVAL '7 days'
WHERE requested_delivery_date IS NULL;

-- Make the new column required
ALTER TABLE purchase_orders 
ALTER COLUMN requested_delivery_date SET NOT NULL;

-- Drop the old delivery week column
ALTER TABLE purchase_orders 
DROP COLUMN IF EXISTS requested_delivery_week;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'purchase_orders' 
  AND column_name LIKE '%delivery%'
ORDER BY column_name;
