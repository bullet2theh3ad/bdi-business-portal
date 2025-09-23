-- COMPREHENSIVE SCAN OF ALL DATABASE TABLES FOR ASK BDI ALGORITHM
-- This analyzes EVERY table in your database for relevancy and content

-- ===== STEP 1: GET ALL TABLES WITH BASIC INFO =====
SELECT 
    t.table_name,
    t.table_type,
    COALESCE(s.n_tup_ins, 0) as estimated_row_count,
    COALESCE(s.n_tup_upd, 0) as estimated_updates,
    COALESCE(s.n_tup_del, 0) as estimated_deletes,
    pg_size_pretty(pg_total_relation_size(c.oid)) as table_size_readable,
    pg_total_relation_size(c.oid) as table_size_bytes,
    obj_description(c.oid) as table_description
FROM information_schema.tables t
LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
LEFT JOIN pg_class c ON c.relname = t.table_name
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT LIKE '_prisma%'
    AND t.table_name NOT LIKE 'drizzle_%'
ORDER BY pg_total_relation_size(c.oid) DESC NULLS LAST;

-- ===== STEP 2: GET ALL COLUMNS FOR ALL TABLES =====
SELECT 
    t.table_name,
    c.column_name,
    c.ordinal_position,
    c.data_type,
    CASE 
        WHEN c.character_maximum_length IS NOT NULL THEN 
            c.data_type || '(' || c.character_maximum_length || ')'
        WHEN c.numeric_precision IS NOT NULL THEN 
            c.data_type || '(' || c.numeric_precision || ',' || COALESCE(c.numeric_scale, 0) || ')'
        WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name
        ELSE c.data_type
    END as full_data_type,
    c.is_nullable,
    c.column_default,
    col_description(pgc.oid, c.ordinal_position) as column_description
FROM information_schema.tables t
JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
LEFT JOIN pg_class pgc ON pgc.relname = t.table_name
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT LIKE '_prisma%'
    AND t.table_name NOT LIKE 'drizzle_%'
ORDER BY t.table_name, c.ordinal_position;

-- ===== STEP 3: GET ALL FOREIGN KEY RELATIONSHIPS =====
SELECT 
    tc.table_name as source_table,
    kcu.column_name as source_column,
    ccu.table_name as referenced_table,
    ccu.column_name as referenced_column,
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

-- ===== STEP 4: SAMPLE DATA FROM EACH TABLE (First 2 rows) =====

-- Organizations
SELECT 'organizations' as table_name, COUNT(*) as total_rows FROM organizations;
SELECT * FROM organizations ORDER BY created_at DESC LIMIT 2;

-- Users  
SELECT 'users' as table_name, COUNT(*) as total_rows FROM users;
SELECT 
    u.auth_id, 
    u.name, 
    u.email, 
    u.role,
    o.name as organization_name,
    o.code as organization_code,
    om.role as org_role,
    u.created_at 
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
ORDER BY u.created_at DESC 
LIMIT 2;

-- Organization Members
SELECT 'organization_members' as table_name, COUNT(*) as total_rows FROM organization_members;
SELECT * FROM organization_members ORDER BY created_at DESC LIMIT 2;

-- Sales Forecasts
SELECT 'sales_forecasts' as table_name, COUNT(*) as total_rows FROM sales_forecasts;
SELECT id, sku_id, delivery_week, quantity, sales_signal, factory_signal, custom_exw_date, created_by, created_at FROM sales_forecasts ORDER BY created_at DESC LIMIT 2;

-- Shipments
SELECT 'shipments' as table_name, COUNT(*) as total_rows FROM shipments;
SELECT id, shipment_number, forecast_id, status, sales_signal, factory_signal, created_by, created_at FROM shipments ORDER BY created_at DESC LIMIT 2;

-- Invoices
SELECT 'invoices' as table_name, COUNT(*) as total_rows FROM invoices;
SELECT id, invoice_number, customer_name, status, total_value, created_by, created_at FROM invoices ORDER BY created_at DESC LIMIT 2;

-- Purchase Orders (if exists)
SELECT 'purchase_orders' as table_name, COUNT(*) as total_rows FROM purchase_orders;
SELECT id, purchase_order_number, supplier_name, organization_id, status, total_value, created_by, created_at FROM purchase_orders ORDER BY created_at DESC LIMIT 2;

-- Product SKUs
SELECT 'product_skus' as table_name, COUNT(*) as total_rows FROM product_skus;
SELECT id, sku, name, hts_code, boxes_per_carton, created_at FROM product_skus ORDER BY created_at DESC LIMIT 2;

-- Warehouses
SELECT 'warehouses' as table_name, COUNT(*) as total_rows FROM warehouses;
SELECT id, name, code, type, organization_id, created_at FROM warehouses ORDER BY created_at DESC LIMIT 2;

-- Production Files
SELECT 'production_files' as table_name, COUNT(*) as total_rows FROM production_files;
SELECT id, file_name, file_type, organization_id, bdi_shipment_number, created_at FROM production_files ORDER BY created_at DESC LIMIT 2;

-- Invoice Documents (if exists)
SELECT 'invoice_documents' as table_name, COUNT(*) as total_rows FROM invoice_documents;
SELECT id, invoice_id, file_name, file_path, uploaded_by, uploaded_at FROM invoice_documents ORDER BY uploaded_at DESC LIMIT 2;

-- Purchase Order Documents (if exists)  
SELECT 'purchase_order_documents' as table_name, COUNT(*) as total_rows FROM purchase_order_documents;
SELECT id, purchase_order_id, file_name, file_path, uploaded_by, uploaded_at FROM purchase_order_documents ORDER BY uploaded_at DESC LIMIT 2;

-- RAG Documents (if exists)
SELECT 'rag_documents' as table_name, COUNT(*) as total_rows FROM rag_documents;
SELECT id, title, document_type, organization_id, uploaded_by, created_at FROM rag_documents ORDER BY created_at DESC LIMIT 2;

-- JJOLM Tracking (if exists)
SELECT 'jjolm_tracking' as table_name, COUNT(*) as total_rows FROM jjolm_tracking;
SELECT id, jjolm_number, origin, destination, status, pickup_date, delivery_date FROM jjolm_tracking ORDER BY upload_date DESC LIMIT 2;

-- ===== STEP 5: CHECK STORAGE BUCKETS =====
SELECT 
    name as bucket_name,
    id as bucket_id,
    created_at,
    updated_at,
    public
FROM storage.buckets
ORDER BY created_at;

-- ===== STEP 6: SAMPLE FILES FROM ORGANIZATION-DOCUMENTS BUCKET =====
SELECT 
    name as file_path,
    id as file_id,
    updated_at,
    created_at,
    last_accessed_at,
    metadata
FROM storage.objects 
WHERE bucket_id = 'organization-documents'
ORDER BY created_at DESC 
LIMIT 10;
