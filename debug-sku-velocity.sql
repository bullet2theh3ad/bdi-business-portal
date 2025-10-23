-- Debug script to check if MQ20-D80W-U has sales data
-- Run this in Supabase SQL Editor to investigate the issue

-- Check if the SKU exists in Amazon financial line items
SELECT 
    bdi_sku,
    amazon_sku,
    transaction_type,
    quantity,
    item_price,
    net_revenue,
    posted_date,
    order_id
FROM amazon_financial_line_items 
WHERE bdi_sku = 'MQ20-D80W-U'
ORDER BY posted_date DESC
LIMIT 10;

-- Check total sales for this SKU
SELECT 
    bdi_sku,
    COUNT(*) as total_transactions,
    SUM(quantity) as total_units,
    SUM(item_price) as total_gross_revenue,
    SUM(net_revenue) as total_net_revenue,
    MIN(posted_date) as first_sale,
    MAX(posted_date) as last_sale
FROM amazon_financial_line_items 
WHERE bdi_sku = 'MQ20-D80W-U'
    AND transaction_type = 'sale'
    AND quantity > 0
GROUP BY bdi_sku;

-- Check if there are any data quality issues
SELECT 
    bdi_sku,
    COUNT(*) as total_records,
    COUNT(CASE WHEN bdi_sku IS NULL THEN 1 END) as null_bdi_sku,
    COUNT(CASE WHEN amazon_sku IS NULL THEN 1 END) as null_amazon_sku,
    COUNT(CASE WHEN quantity IS NULL THEN 1 END) as null_quantity,
    COUNT(CASE WHEN item_price IS NULL THEN 1 END) as null_item_price,
    COUNT(CASE WHEN net_revenue IS NULL THEN 1 END) as null_net_revenue,
    COUNT(CASE WHEN posted_date IS NULL THEN 1 END) as null_posted_date
FROM amazon_financial_line_items 
WHERE bdi_sku = 'MQ20-D80W-U'
GROUP BY bdi_sku;

-- Check recent sales data for this SKU (last 30 days)
SELECT 
    bdi_sku,
    DATE(posted_date) as sale_date,
    COUNT(*) as daily_transactions,
    SUM(quantity) as daily_units,
    SUM(item_price) as daily_gross_revenue,
    SUM(net_revenue) as daily_net_revenue
FROM amazon_financial_line_items 
WHERE bdi_sku = 'MQ20-D80W-U'
    AND transaction_type = 'sale'
    AND quantity > 0
    AND posted_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY bdi_sku, DATE(posted_date)
ORDER BY sale_date DESC;
