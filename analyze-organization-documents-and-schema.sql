-- Comprehensive Analysis of Organization Documents Bucket and Database Schema
-- This provides complete visibility for Ask BDI algorithm updates

-- ===== PART 1: ORGANIZATION DOCUMENTS BUCKET ANALYSIS =====

-- Get all files in organization-documents bucket with metadata
SELECT 
    name as file_path,
    id as file_id,
    updated_at as last_modified,
    created_at as uploaded_at,
    last_accessed_at,
    metadata,
    CASE 
        WHEN name LIKE '%.pdf' THEN 'PDF Document'
        WHEN name LIKE '%.xlsx' OR name LIKE '%.xls' THEN 'Excel Spreadsheet'
        WHEN name LIKE '%.csv' THEN 'CSV Data'
        WHEN name LIKE '%.docx' OR name LIKE '%.doc' THEN 'Word Document'
        WHEN name LIKE '%.txt' THEN 'Text File'
        WHEN name LIKE '%.json' THEN 'JSON Data'
        ELSE 'Other'
    END as file_type,
    CASE 
        WHEN name LIKE '%/production-files/%' THEN 'Production Files'
        WHEN name LIKE '%/invoices/%' THEN 'Invoice Documents'
        WHEN name LIKE '%/purchase-orders/%' THEN 'Purchase Order Documents'
        WHEN name LIKE '%/shipments/%' THEN 'Shipment Documents'
        WHEN name LIKE '%/warehouses/%' THEN 'Warehouse Documents'
        WHEN name LIKE '%/rag-documents/%' THEN 'RAG Knowledge Base'
        WHEN name LIKE '%/templates/%' THEN 'Template Files'
        ELSE 'Uncategorized'
    END as document_category,
    -- Extract organization ID from path
    SPLIT_PART(name, '/', 1) as organization_id
FROM storage.objects 
WHERE bucket_id = 'organization-documents'
ORDER BY created_at DESC;

-- Count files by organization and type
SELECT 
    SPLIT_PART(name, '/', 1) as organization_id,
    CASE 
        WHEN name LIKE '%.pdf' THEN 'PDF'
        WHEN name LIKE '%.xlsx' OR name LIKE '%.xls' THEN 'Excel'
        WHEN name LIKE '%.csv' THEN 'CSV'
        WHEN name LIKE '%.docx' OR name LIKE '%.doc' THEN 'Word'
        WHEN name LIKE '%.txt' THEN 'Text'
        WHEN name LIKE '%.json' THEN 'JSON'
        ELSE 'Other'
    END as file_type,
    COUNT(*) as file_count,
    SUM(COALESCE((metadata->>'size')::bigint, 0)) as total_size_bytes
FROM storage.objects 
WHERE bucket_id = 'organization-documents'
GROUP BY SPLIT_PART(name, '/', 1), 
    CASE 
        WHEN name LIKE '%.pdf' THEN 'PDF'
        WHEN name LIKE '%.xlsx' OR name LIKE '%.xls' THEN 'Excel'
        WHEN name LIKE '%.csv' THEN 'CSV'
        WHEN name LIKE '%.docx' OR name LIKE '%.doc' THEN 'Word'
        WHEN name LIKE '%.txt' THEN 'Text'
        WHEN name LIKE '%.json' THEN 'JSON'
        ELSE 'Other'
    END
ORDER BY organization_id, file_count DESC;

-- ===== PART 2: COMPLETE DATABASE SCHEMA ANALYSIS =====

-- Get all tables with row counts and relationships
SELECT 
    t.table_name,
    t.table_type,
    COALESCE(s.n_tup_ins, 0) as estimated_rows,
    pg_size_pretty(pg_total_relation_size(c.oid)) as table_size,
    obj_description(c.oid) as table_comment
FROM information_schema.tables t
LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
LEFT JOIN pg_class c ON c.relname = t.table_name
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT LIKE '_prisma%'
ORDER BY estimated_rows DESC NULLS LAST;

-- Get all columns for each table with data types and constraints
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    CASE 
        WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name
        WHEN c.character_maximum_length IS NOT NULL THEN 
            c.data_type || '(' || c.character_maximum_length || ')'
        WHEN c.numeric_precision IS NOT NULL THEN 
            c.data_type || '(' || c.numeric_precision || ',' || COALESCE(c.numeric_scale, 0) || ')'
        ELSE c.data_type
    END as full_data_type,
    col_description(pgc.oid, c.ordinal_position) as column_comment
FROM information_schema.tables t
JOIN information_schema.columns c ON c.table_name = t.table_name
LEFT JOIN pg_class pgc ON pgc.relname = t.table_name
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT LIKE '_prisma%'
ORDER BY t.table_name, c.ordinal_position;

-- Get all foreign key relationships
SELECT 
    tc.table_name as source_table,
    kcu.column_name as source_column,
    ccu.table_name as target_table,
    ccu.column_name as target_column,
    tc.constraint_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ===== PART 3: BUSINESS DATA ANALYSIS =====

-- Organizations and their document/data footprint
SELECT 
    o.id,
    o.name,
    o.code,
    o.type,
    COUNT(DISTINCT om.user_auth_id) as user_count,
    COUNT(DISTINCT sf.id) as forecast_count,
    COUNT(DISTINCT s.id) as shipment_count,
    COUNT(DISTINCT i.id) as invoice_count,
    COUNT(DISTINCT po.id) as purchase_order_count,
    COUNT(DISTINCT w.id) as warehouse_count
FROM organizations o
LEFT JOIN organization_members om ON om.organization_uuid = o.id
LEFT JOIN sales_forecasts sf ON sf.created_by IN (
    SELECT user_auth_id FROM organization_members WHERE organization_uuid = o.id
)
LEFT JOIN shipments s ON s.created_by IN (
    SELECT user_auth_id FROM organization_members WHERE organization_uuid = o.id
)
LEFT JOIN invoices i ON i.customer_name = o.code
LEFT JOIN purchase_orders po ON po.organization_id = o.id  
LEFT JOIN warehouses w ON w.organization_id = o.id
GROUP BY o.id, o.name, o.code, o.type
ORDER BY forecast_count DESC, shipment_count DESC;

-- CPFR Data Relationships and Volumes
SELECT 
    'Sales Forecasts' as data_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT sku_id) as unique_skus,
    COUNT(DISTINCT created_by) as unique_users,
    MIN(created_at) as earliest_record,
    MAX(created_at) as latest_record,
    COUNT(*) FILTER (WHERE sales_signal != 'unknown') as active_sales_signals,
    COUNT(*) FILTER (WHERE factory_signal != 'unknown') as active_factory_signals,
    COUNT(*) FILTER (WHERE custom_exw_date IS NOT NULL) as has_exw_dates,
    COUNT(*) FILTER (WHERE date_change_history != '[]'::jsonb) as has_date_changes
FROM sales_forecasts

UNION ALL

SELECT 
    'Shipments' as data_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT forecast_id) as linked_forecasts,
    COUNT(DISTINCT created_by) as unique_users,
    MIN(created_at) as earliest_record,
    MAX(created_at) as latest_record,
    COUNT(*) FILTER (WHERE sales_signal IS NOT NULL) as has_sales_signals,
    COUNT(*) FILTER (WHERE factory_signal IS NOT NULL) as has_factory_signals,
    COUNT(*) FILTER (WHERE shipper_reference IS NOT NULL) as has_tracking_refs,
    COUNT(*) FILTER (WHERE notes IS NOT NULL AND notes != '') as has_notes
FROM shipments

UNION ALL

SELECT 
    'Invoices' as data_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT customer_organization_id) as unique_customers,
    COUNT(DISTINCT created_by) as unique_users,
    MIN(created_at) as earliest_record,
    MAX(created_at) as latest_record,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
    COUNT(*) FILTER (WHERE cfo_approved = true) as cfo_approved_count,
    COUNT(*) FILTER (WHERE invoice_number IS NOT NULL) as has_invoice_numbers,
    COUNT(*) FILTER (WHERE notes IS NOT NULL AND notes != '') as has_notes
FROM invoices

UNION ALL

SELECT 
    'Purchase Orders' as data_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT customer_organization_id) as unique_customers,
    COUNT(DISTINCT created_by) as unique_users,
    MIN(created_at) as earliest_record,
    MAX(created_at) as latest_record,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
    COUNT(*) FILTER (WHERE delivery_date IS NOT NULL) as has_delivery_dates,
    COUNT(*) FILTER (WHERE po_number IS NOT NULL) as has_po_numbers,
    COUNT(*) FILTER (WHERE notes IS NOT NULL AND notes != '') as has_notes
FROM purchase_orders

UNION ALL

SELECT 
    'Production Files' as data_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT organization_id) as unique_organizations,
    COUNT(DISTINCT uploaded_by) as unique_uploaders,
    MIN(created_at) as earliest_record,
    MAX(created_at) as latest_record,
    COUNT(*) FILTER (WHERE file_type = 'PRODUCTION_SCHEDULE') as production_schedules,
    COUNT(*) FILTER (WHERE file_type = 'QUALITY_REPORT') as quality_reports,
    COUNT(*) FILTER (WHERE bdi_shipment_number IS NOT NULL) as linked_to_shipments,
    COUNT(*) FILTER (WHERE description IS NOT NULL AND description != '') as has_descriptions
FROM production_files

ORDER BY total_records DESC;

-- ===== PART 4: CPFR SIGNAL ANALYSIS =====

-- Current state of all CPFR signals across forecasts
SELECT 
    sales_signal,
    factory_signal,
    transit_signal,
    warehouse_signal,
    COUNT(*) as forecast_count,
    COUNT(*) FILTER (WHERE custom_exw_date IS NOT NULL) as has_exw_date,
    COUNT(*) FILTER (WHERE date_change_history != '[]'::jsonb) as has_changes,
    AVG(quantity) as avg_quantity
FROM sales_forecasts
GROUP BY sales_signal, factory_signal, transit_signal, warehouse_signal
ORDER BY forecast_count DESC;

-- ===== PART 5: DOCUMENT LINKAGE ANALYSIS =====

-- Show how documents are linked to business records
SELECT 
    'Invoice Documents' as document_type,
    COUNT(DISTINCT id.invoice_id) as linked_records,
    COUNT(*) as total_documents,
    'invoice_docs' as document_types
FROM invoice_documents id

UNION ALL

SELECT 
    'Purchase Order Documents' as document_type,
    COUNT(DISTINCT pod.purchase_order_id) as linked_records,
    COUNT(*) as total_documents,
    'purchase_order_docs' as document_types
FROM purchase_order_documents pod

-- Note: Shipment Documents and Warehouse Documents tables may not exist yet
-- Commenting out until table structure is confirmed

-- UNION ALL
-- SELECT 
--     'Shipment Documents' as document_type,
--     COUNT(DISTINCT sd.shipment_id) as linked_records,
--     COUNT(*) as total_documents,
--     'shipment_docs' as document_types
-- FROM shipment_documents sd

-- UNION ALL
-- SELECT 
--     'Warehouse Documents' as document_type,
--     COUNT(DISTINCT wd.warehouse_id) as linked_records,
--     COUNT(*) as total_documents,
--     'warehouse_docs' as document_types
-- FROM warehouse_documents wd

UNION ALL

SELECT 
    'Production Files' as document_type,
    COUNT(DISTINCT pf.organization_id) as linked_records,
    COUNT(*) as total_documents,
    STRING_AGG(DISTINCT pf.file_type, ', ') as document_types
FROM production_files pf

UNION ALL

SELECT 
    'RAG Documents' as document_type,
    COUNT(DISTINCT rd.organization_id) as linked_records,
    COUNT(*) as total_documents,
    STRING_AGG(DISTINCT rd.document_type, ', ') as document_types
FROM rag_documents rd;

-- ===== PART 6: USER AND ORGANIZATION ACCESS PATTERNS =====

-- Show user access patterns and data ownership
SELECT 
    u.name as user_name,
    u.email,
    u.role,
    o.name as organization_name,
    o.code as org_code,
    o.type as org_type,
    om.role as membership_role,
    COUNT(DISTINCT sf.id) as forecasts_created,
    COUNT(DISTINCT s.id) as shipments_created,
    COUNT(DISTINCT pf.id) as files_uploaded,
    u.last_login_at
FROM users u
LEFT JOIN organization_members om ON om.user_auth_id = u.auth_id
LEFT JOIN organizations o ON o.id = om.organization_uuid
LEFT JOIN sales_forecasts sf ON sf.created_by = u.auth_id
LEFT JOIN shipments s ON s.created_by = u.auth_id
LEFT JOIN production_files pf ON pf.uploaded_by = u.auth_id
WHERE u.is_active = true
GROUP BY u.auth_id, u.name, u.email, u.role, o.name, o.code, o.type, om.role, u.last_login_at
ORDER BY forecasts_created DESC, shipments_created DESC;

-- ===== PART 7: COMPREHENSIVE TABLE SCHEMA WITH RELATIONSHIPS =====

-- Complete schema overview with foreign key relationships
WITH table_info AS (
    SELECT 
        t.table_name,
        COUNT(c.column_name) as column_count,
        COALESCE(s.n_tup_ins, 0) as estimated_rows,
        pg_size_pretty(pg_total_relation_size(pgc.oid)) as table_size,
        obj_description(pgc.oid) as table_comment
    FROM information_schema.tables t
    LEFT JOIN information_schema.columns c ON c.table_name = t.table_name
    LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
    LEFT JOIN pg_class pgc ON pgc.relname = t.table_name
    WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT LIKE 'pg_%'
        AND t.table_name NOT LIKE '_prisma%'
    GROUP BY t.table_name, s.n_tup_ins, pgc.oid
),
fk_relationships AS (
    SELECT 
        tc.table_name as source_table,
        STRING_AGG(
            kcu.column_name || ' → ' || ccu.table_name || '.' || ccu.column_name, 
            ', '
        ) as foreign_keys
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    GROUP BY tc.table_name
)
SELECT 
    ti.table_name,
    ti.column_count,
    ti.estimated_rows,
    ti.table_size,
    COALESCE(fk.foreign_keys, 'No foreign keys') as relationships,
    ti.table_comment
FROM table_info ti
LEFT JOIN fk_relationships fk ON fk.source_table = ti.table_name
ORDER BY ti.estimated_rows DESC NULLS LAST;

-- ===== PART 8: BUSINESS PROCESS DATA FLOWS =====

-- Show complete CPFR data flow relationships
SELECT 
    'CPFR Flow Analysis' as analysis_type,
    sf.id as forecast_id,
    sf.delivery_week,
    sf.quantity,
    sf.sales_signal,
    sf.factory_signal,
    sf.transit_signal,
    sf.warehouse_signal,
    ps.sku,
    ps.name as product_name,
    s.id as shipment_id,
    s.shipment_number,
    s.status as shipment_status,
    i.invoice_number,
    po.purchase_order_number,
    o.name as creator_org,
    u.name as created_by_user
FROM sales_forecasts sf
LEFT JOIN product_skus ps ON ps.id = sf.sku_id
LEFT JOIN shipments s ON s.forecast_id = sf.id
LEFT JOIN invoices i ON i.id = sf.purchase_order_id
LEFT JOIN purchase_orders po ON po.id = sf.purchase_order_id
LEFT JOIN users u ON u.auth_id = sf.created_by
LEFT JOIN organization_members om ON om.user_auth_id = u.auth_id
LEFT JOIN organizations o ON o.id = om.organization_uuid
ORDER BY sf.created_at DESC
LIMIT 20;

-- ===== PART 9: STORAGE BUCKET ANALYSIS =====

-- Analyze all storage buckets and their contents
SELECT 
    bucket_id,
    COUNT(*) as file_count,
    SUM(COALESCE((metadata->>'size')::bigint, 0)) as total_size_bytes,
    pg_size_pretty(SUM(COALESCE((metadata->>'size')::bigint, 0))) as total_size_readable,
    MIN(created_at) as earliest_file,
    MAX(created_at) as latest_file,
    COUNT(DISTINCT SPLIT_PART(name, '/', 1)) as unique_org_folders
FROM storage.objects
GROUP BY bucket_id
ORDER BY file_count DESC;

-- Show file distribution across organization folders
SELECT 
    bucket_id,
    SPLIT_PART(name, '/', 1) as organization_folder,
    COUNT(*) as file_count,
    STRING_AGG(DISTINCT 
        CASE 
            WHEN name LIKE '%.pdf' THEN 'PDF'
            WHEN name LIKE '%.xlsx' OR name LIKE '%.xls' THEN 'Excel'
            WHEN name LIKE '%.csv' THEN 'CSV'
            WHEN name LIKE '%.docx' OR name LIKE '%.doc' THEN 'Word'
            WHEN name LIKE '%.txt' THEN 'Text'
            WHEN name LIKE '%.json' THEN 'JSON'
            ELSE 'Other'
        END, 
        ', '
    ) as file_types
FROM storage.objects
WHERE bucket_id = 'organization-documents'
GROUP BY bucket_id, SPLIT_PART(name, '/', 1)
ORDER BY file_count DESC;
