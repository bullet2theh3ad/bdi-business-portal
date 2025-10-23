-- Find where MQ20-D80W-U Amazon Financial data is actually stored
-- Run this in Supabase SQL Editor

-- 1. Check all tables that might contain Amazon financial data
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%amazon%' 
   OR table_name LIKE '%financial%'
   OR table_name LIKE '%sales%'
ORDER BY table_name;

-- 2. Check if MQ20-D80W-U exists in any Amazon-related table
-- (We'll need to run this for each table we find)

-- 3. Check the most likely candidates first
-- Let's first see what columns exist in these tables
SELECT 'amazon_financial_line_items' as table_name, column_name
FROM information_schema.columns 
WHERE table_name = 'amazon_financial_line_items' 
  AND column_name LIKE '%sku%'
UNION ALL
SELECT 'amazon_financial_summaries' as table_name, column_name
FROM information_schema.columns 
WHERE table_name = 'amazon_financial_summaries' 
  AND column_name LIKE '%sku%'
UNION ALL
SELECT 'amazon_inventory_summaries' as table_name, column_name
FROM information_schema.columns 
WHERE table_name = 'amazon_inventory_summaries' 
  AND column_name LIKE '%sku%';

-- 4. Check what tables have the most recent data
SELECT 'amazon_financial_line_items' as table_name, MAX(created_at) as latest_data
FROM amazon_financial_line_items 
UNION ALL
SELECT 'amazon_financial_summaries' as table_name, MAX(created_at) as latest_data
FROM amazon_financial_summaries 
UNION ALL
SELECT 'amazon_inventory_summaries' as table_name, MAX(created_at) as latest_data
FROM amazon_inventory_summaries;
