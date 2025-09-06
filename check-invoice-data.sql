-- Check invoice data structure
SELECT 
    customer_name as org_code,
    COUNT(*) as invoice_count,
    SUM(total_value) as total_value,
    to_char(created_at, 'Mon YYYY') as month
FROM invoices 
WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
  AND customer_name IS NOT NULL
GROUP BY customer_name, to_char(created_at, 'Mon YYYY'), date_trunc('month', created_at)
ORDER BY date_trunc('month', created_at) DESC, total_value DESC;
