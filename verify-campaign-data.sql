-- Verify Amazon Campaign Data in Database

-- Check uploads table
SELECT 
    id,
    file_name,
    upload_date,
    row_count,
    date_range_start,
    date_range_end,
    status
FROM amazon_campaign_uploads
ORDER BY upload_date DESC
LIMIT 5;

-- Check campaign data table
SELECT 
    COUNT(*) as total_campaigns,
    COUNT(DISTINCT extracted_sku) as unique_skus,
    SUM(spend_converted) as total_spend,
    SUM(sales_converted) as total_sales,
    SUM(orders) as total_orders
FROM amazon_campaign_data;

-- Check campaigns by SKU
SELECT 
    extracted_sku,
    COUNT(*) as campaign_count,
    SUM(spend_converted) as total_spend,
    SUM(sales_converted) as total_sales,
    SUM(orders) as total_orders,
    ROUND(AVG(acos)::numeric, 4) as avg_acos,
    ROUND(AVG(roas)::numeric, 2) as avg_roas
FROM amazon_campaign_data
WHERE extracted_sku IS NOT NULL
GROUP BY extracted_sku
ORDER BY total_spend DESC;

-- Sample of actual campaign records
SELECT 
    campaign_name,
    extracted_sku,
    country,
    state,
    spend_converted,
    sales_converted,
    orders,
    acos,
    roas
FROM amazon_campaign_data
ORDER BY spend_converted DESC
LIMIT 10;

