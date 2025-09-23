-- COMPREHENSIVE SECURITY AND SCHEMA ANALYSIS FOR ASK BDI
-- This analyzes all tables, RLS policies, and generates complete schema for Ask BDI algorithm

-- ===== STEP 1: GET ALL TABLES WITH RLS STATUS =====
SELECT 
    t.table_name,
    t.table_type,
    CASE 
        WHEN p.tablename IS NOT NULL THEN 'RLS_ENABLED'
        ELSE 'UNRESTRICTED'
    END as rls_status,
    COALESCE(s.n_tup_ins, 0) as estimated_row_count,
    pg_size_pretty(pg_total_relation_size(c.oid)) as table_size_readable,
    pg_total_relation_size(c.oid) as table_size_bytes,
    obj_description(c.oid) as table_description
FROM information_schema.tables t
LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
LEFT JOIN pg_class c ON c.relname = t.table_name
LEFT JOIN (
    SELECT DISTINCT tablename 
    FROM pg_policies 
    WHERE schemaname = 'public'
) p ON p.tablename = t.table_name
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT LIKE '_prisma%'
    AND t.table_name NOT LIKE 'drizzle_%'
ORDER BY 
    CASE WHEN p.tablename IS NULL THEN 0 ELSE 1 END, -- Unrestricted first
    pg_total_relation_size(c.oid) DESC NULLS LAST;

-- ===== STEP 2: DETAILED RLS POLICY ANALYSIS =====
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ===== STEP 3: IDENTIFY CRITICAL SECURITY GAPS =====
SELECT 
    'CRITICAL_SECURITY_GAP' as alert_type,
    t.table_name,
    'No RLS policies found' as issue,
    CASE 
        WHEN t.table_name IN ('api_keys', 'users', 'organizations', 'invoices', 'purchase_orders') 
        THEN 'HIGH_RISK'
        WHEN t.table_name LIKE '%document%' OR t.table_name LIKE '%file%'
        THEN 'MEDIUM_RISK'
        ELSE 'LOW_RISK'
    END as risk_level,
    COALESCE(s.n_tup_ins, 0) as exposed_records
FROM information_schema.tables t
LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
LEFT JOIN (
    SELECT DISTINCT tablename 
    FROM pg_policies 
    WHERE schemaname = 'public'
) p ON p.tablename = t.table_name
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT LIKE '_prisma%'
    AND t.table_name NOT LIKE 'drizzle_%'
    AND p.tablename IS NULL  -- No RLS policies
ORDER BY 
    CASE 
        WHEN t.table_name IN ('api_keys', 'users', 'organizations', 'invoices', 'purchase_orders') THEN 1
        WHEN t.table_name LIKE '%document%' OR t.table_name LIKE '%file%' THEN 2
        ELSE 3
    END,
    COALESCE(s.n_tup_ins, 0) DESC;

-- ===== STEP 4: COMPLETE COLUMN ANALYSIS FOR ALL TABLES =====
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
    col_description(pgc.oid, c.ordinal_position) as column_description,
    -- Identify sensitive columns
    CASE 
        WHEN c.column_name LIKE '%password%' OR c.column_name LIKE '%secret%' OR c.column_name LIKE '%key%' 
        THEN 'SENSITIVE'
        WHEN c.column_name LIKE '%email%' OR c.column_name LIKE '%phone%' OR c.column_name LIKE '%address%'
        THEN 'PII'
        WHEN c.column_name LIKE '%auth%' OR c.column_name LIKE '%token%'
        THEN 'AUTH'
        ELSE 'STANDARD'
    END as column_sensitivity
FROM information_schema.tables t
JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
LEFT JOIN pg_class pgc ON pgc.relname = t.table_name
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT LIKE '_prisma%'
    AND t.table_name NOT LIKE 'drizzle_%'
ORDER BY t.table_name, c.ordinal_position;

-- ===== STEP 5: COMPLETE FOREIGN KEY RELATIONSHIP MAP =====
SELECT 
    tc.table_name as source_table,
    kcu.column_name as source_column,
    ccu.table_name as referenced_table,
    ccu.column_name as referenced_column,
    tc.constraint_name,
    rc.update_rule,
    rc.delete_rule,
    -- Business relationship context
    CASE 
        WHEN tc.table_name LIKE '%document%' AND ccu.table_name IN ('organizations', 'users', 'invoices', 'purchase_orders', 'shipments')
        THEN 'DOCUMENT_LINK'
        WHEN ccu.table_name = 'organizations'
        THEN 'ORG_SCOPED'
        WHEN ccu.table_name = 'users'
        THEN 'USER_SCOPED'
        ELSE 'BUSINESS_LOGIC'
    END as relationship_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ===== STEP 6: STORAGE BUCKET SECURITY ANALYSIS =====
SELECT 
    b.name as bucket_name,
    b.id as bucket_id,
    b.public as is_public_bucket,
    b.created_at,
    b.updated_at,
    COUNT(o.id) as file_count,
    pg_size_pretty(SUM(COALESCE((o.metadata->>'size')::bigint, 0))) as total_size,
    -- Security assessment
    CASE 
        WHEN b.public = true THEN 'PUBLIC_ACCESS'
        ELSE 'PRIVATE_ACCESS'
    END as security_status
FROM storage.buckets b
LEFT JOIN storage.objects o ON o.bucket_id = b.name
GROUP BY b.name, b.id, b.public, b.created_at, b.updated_at
ORDER BY b.created_at;

-- ===== STEP 7: SAMPLE DATA FROM KEY BUSINESS TABLES =====

-- Organizations (critical for Ask BDI context)
SELECT 'organizations' as table_name, COUNT(*) as total_rows FROM organizations;
SELECT id, name, code, type, created_at, updated_at FROM organizations ORDER BY created_at DESC LIMIT 5;

-- Users (for understanding access patterns) - FIXED: Join with organization_members
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
LIMIT 5;

-- Sales Forecasts (core CPFR data)
SELECT 'sales_forecasts' as table_name, COUNT(*) as total_rows FROM sales_forecasts;
SELECT id, sku_id, delivery_week, quantity, sales_signal, factory_signal, transit_signal, warehouse_signal, custom_exw_date, created_by, created_at FROM sales_forecasts ORDER BY created_at DESC LIMIT 5;

-- Shipments (operational data)
SELECT 'shipments' as table_name, COUNT(*) as total_rows FROM shipments;
SELECT id, shipment_number, forecast_id, status, sales_signal, factory_signal, transit_signal, warehouse_signal, created_by, created_at FROM shipments ORDER BY created_at DESC LIMIT 5;

-- Invoices (financial data)
SELECT 'invoices' as table_name, COUNT(*) as total_rows FROM invoices;
SELECT id, invoice_number, customer_name, status, total_value, created_by, created_at FROM invoices ORDER BY created_at DESC LIMIT 5;

-- Purchase Orders (procurement data) - FIXED: organization_id is correct
SELECT 'purchase_orders' as table_name, COUNT(*) as total_rows FROM purchase_orders;
SELECT id, purchase_order_number, supplier_name, organization_id, status, total_value, created_by, created_at FROM purchase_orders ORDER BY created_at DESC LIMIT 5;

-- Warehouses (location data) - FIXED: warehouse_code and organization_id
SELECT 'warehouses' as table_name, COUNT(*) as total_rows FROM warehouses;
SELECT id, name, warehouse_code, capabilities, organization_id, created_at FROM warehouses ORDER BY created_at DESC LIMIT 5;

-- Product SKUs (product catalog)
SELECT 'product_skus' as table_name, COUNT(*) as total_rows FROM product_skus;
SELECT id, sku, name, hts_code, boxes_per_carton, created_at FROM product_skus ORDER BY created_at DESC LIMIT 5;

-- ===== STEP 8: DOCUMENT AND FILE STORAGE ANALYSIS =====

-- Production Files - FIXED: organization_id exists in this table
SELECT 'production_files' as table_name, COUNT(*) as total_rows FROM production_files;
SELECT id, file_name, file_type, organization_id, bdi_shipment_number, created_at FROM production_files ORDER BY created_at DESC LIMIT 3;

-- Organization Documents table (check if exists)
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_documents') 
    THEN 'EXISTS' ELSE 'DOES_NOT_EXIST' 
    END as organization_documents_status;

-- ===== STEP 9: API KEYS AND ACCESS ANALYSIS =====
SELECT 'api_keys' as table_name, COUNT(*) as total_rows FROM api_keys;
SELECT id, key_name, organization_uuid, permissions, is_active, user_auth_id as created_by, created_at, last_used_at FROM api_keys ORDER BY created_at DESC LIMIT 5;

-- ===== STEP 10: INVITATION AND USER MANAGEMENT =====
SELECT 'invitations' as table_name, COUNT(*) as total_rows FROM invitations;
SELECT id, email, organization_id, role, status, invited_by, invited_at as created_at, expires_at FROM invitations ORDER BY invited_at DESC LIMIT 5;

-- Organization Invitations (separate table)
SELECT 'organization_invitations' as table_name, COUNT(*) as total_rows FROM organization_invitations WHERE 1=1;

-- ===== SUMMARY FOR ASK BDI ALGORITHM =====
SELECT 
    'ASK_BDI_DATA_SUMMARY' as summary_type,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as total_tables,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_rls_policies,
    (SELECT COUNT(DISTINCT tablename) FROM pg_policies WHERE schemaname = 'public') as tables_with_rls,
    (SELECT COUNT(*) FROM organizations) as total_organizations,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM sales_forecasts WHERE 1=1) as total_forecasts,
    (SELECT COUNT(*) FROM shipments WHERE 1=1) as total_shipments,
    (SELECT COUNT(*) FROM invoices) as total_invoices,
    (SELECT COUNT(*) FROM purchase_orders) as total_purchase_orders,
    (SELECT COUNT(*) FROM storage.buckets) as total_storage_buckets,
    (SELECT COUNT(*) FROM storage.objects) as total_stored_files;