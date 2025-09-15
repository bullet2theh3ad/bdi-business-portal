-- Add missing signal columns to shipments table

-- Add transit_signal column
ALTER TABLE shipments 
ADD COLUMN transit_signal VARCHAR(50);

-- Add warehouse_signal column  
ALTER TABLE shipments 
ADD COLUMN warehouse_signal VARCHAR(50);

-- Verify the columns were added
SELECT 
  'VERIFICATION' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'shipments' 
  AND column_name LIKE '%signal%'
ORDER BY column_name;

-- Show all signal columns now available
SELECT 
  'AVAILABLE SIGNAL COLUMNS' as status,
  'sales_signal, factory_signal, shipping_signal, transit_signal, warehouse_signal' as columns_available;
