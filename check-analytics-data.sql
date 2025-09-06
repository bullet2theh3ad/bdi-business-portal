-- Check what data we have for analytics
SELECT 'Invoices' as table_name, COUNT(*) as count FROM invoices
UNION ALL
SELECT 'Invoice Line Items', COUNT(*) FROM invoice_line_items  
UNION ALL
SELECT 'Purchase Orders', COUNT(*) FROM purchase_orders
UNION ALL
SELECT 'PO Line Items', COUNT(*) FROM purchase_order_line_items
UNION ALL
SELECT 'Sales Forecasts', COUNT(*) FROM sales_forecasts
UNION ALL
SELECT 'Product SKUs', COUNT(*) FROM product_skus
UNION ALL
SELECT 'Organizations', COUNT(*) FROM organizations
UNION ALL
SELECT 'Shipments', COUNT(*) FROM shipments;

-- Check invoice data by organization
SELECT 
    customer_name as org_code,
    COUNT(*) as invoice_count,
    SUM(total_value) as total_value,
    to_char(created_at, 'YYYY-MM') as month
FROM invoices 
WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY customer_name, to_char(created_at, 'YYYY-MM')
ORDER BY month DESC, total_value DESC;

-- Check forecast delivery weeks
SELECT 
    delivery_week,
    COUNT(*) as forecast_count,
    SUM(quantity) as total_units,
    status
FROM sales_forecasts 
WHERE delivery_week >= to_char(CURRENT_DATE, 'YYYY-"W"WW')
GROUP BY delivery_week, status
ORDER BY delivery_week;
