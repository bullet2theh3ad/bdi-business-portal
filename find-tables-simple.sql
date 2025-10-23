-- Simple script to find Amazon-related tables and their SKU columns
-- Run this in Supabase SQL Editor

-- 1. Find all Amazon-related tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%amazon%' 
   OR table_name LIKE '%financial%'
   OR table_name LIKE '%sales%'
ORDER BY table_name;

-- 2. Check what SKU-related columns exist in each table
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE (table_name LIKE '%amazon%' OR table_name LIKE '%financial%' OR table_name LIKE '%sales%')
  AND (column_name LIKE '%sku%' OR column_name LIKE '%bdi%' OR column_name LIKE '%amazon%')
ORDER BY table_name, column_name;
