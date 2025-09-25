-- Check what shipping_preference values exist in sales_forecasts table
SELECT 
    shipping_preference,
    COUNT(*) as count,
    STRING_AGG(DISTINCT delivery_week, ', ') as delivery_weeks
FROM sales_forecasts 
WHERE shipping_preference IS NOT NULL
GROUP BY shipping_preference
ORDER BY count DESC;
 