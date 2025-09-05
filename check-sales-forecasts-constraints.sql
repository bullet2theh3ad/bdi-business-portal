-- Check sales_forecasts table foreign key constraints
-- Run this in Supabase SQL Editor

-- 1. Check the actual sales_forecasts table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'sales_forecasts' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check all foreign key constraints on sales_forecasts
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
  AND tc.table_name = 'sales_forecasts';

-- 3. Check if purchase_orders table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'purchase_orders'
) as purchase_orders_table_exists;

-- 4. Show sample purchase_orders data to see the IDs
SELECT id, purchase_order_number, supplier_name, total_value, created_at
FROM purchase_orders
ORDER BY created_at DESC
LIMIT 5;
