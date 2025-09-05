-- Fix sales_forecasts.purchase_order_id foreign key constraint
-- Run this in Supabase SQL Editor

-- 1. Drop the incorrect foreign key constraint
ALTER TABLE sales_forecasts 
DROP CONSTRAINT IF EXISTS sales_forecasts_purchase_order_id_fkey;

-- 2. Add the correct foreign key constraint pointing to purchase_orders table
ALTER TABLE sales_forecasts 
ADD CONSTRAINT sales_forecasts_purchase_order_id_fkey 
FOREIGN KEY (purchase_order_id) 
REFERENCES purchase_orders(id) 
ON DELETE SET NULL;

-- 3. Verify the constraint was created correctly
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'sales_forecasts'
  AND kcu.column_name = 'purchase_order_id';
