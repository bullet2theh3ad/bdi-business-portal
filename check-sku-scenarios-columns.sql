-- Check what columns actually exist in sku_financial_scenarios table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'sku_financial_scenarios'
ORDER BY 
    ordinal_position;

