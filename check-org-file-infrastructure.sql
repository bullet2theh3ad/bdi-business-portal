-- Check organization setup differences between MTN and CBN
SELECT 
    'Organizations' as table_name,
    code,
    name,
    is_active,
    created_at
FROM organizations 
WHERE code IN ('MTN', 'CBN')
ORDER BY code;

-- Check if CBN has any file uploads vs MTN
SELECT 
    'Invoice Documents' as type,
    COUNT(*) as count,
    string_agg(DISTINCT file_path, ', ') as sample_paths
FROM invoice_documents id
JOIN invoices i ON id.invoice_id = i.id
WHERE i.customer_name IN ('MTN', 'CBN')
GROUP BY i.customer_name
ORDER BY i.customer_name;

-- Check PO documents
SELECT 
    'PO Documents' as type,
    po.supplier_name as org,
    COUNT(*) as count,
    string_agg(DISTINCT pd.file_path, ', ') as sample_paths
FROM purchase_order_documents pd
JOIN purchase_orders po ON pd.purchase_order_id = po.id
WHERE po.supplier_name IN ('MTN', 'CBN')
GROUP BY po.supplier_name
ORDER BY po.supplier_name;

-- Check Supabase storage bucket structure differences
SELECT 
    'Production Files' as type,
    COUNT(*) as count,
    string_agg(DISTINCT file_path, ', ') as sample_paths
FROM production_files
WHERE file_path LIKE '%MTN%' OR file_path LIKE '%CBN%'
GROUP BY CASE 
    WHEN file_path LIKE '%MTN%' THEN 'MTN'
    WHEN file_path LIKE '%CBN%' THEN 'CBN'
    ELSE 'Other'
END;
