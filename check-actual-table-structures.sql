-- First, let's understand the ACTUAL table structures before creating analysis queries
-- This will show us the real column names and relationships

-- ===== STEP 1: GET ALL TABLES =====
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
    AND table_name NOT LIKE '_prisma%'
ORDER BY table_name;

-- ===== STEP 2: GET INVOICE TABLE STRUCTURE =====
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'invoices' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- ===== STEP 3: GET PURCHASE ORDERS TABLE STRUCTURE =====
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'purchase_orders' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- ===== STEP 4: GET SALES FORECASTS TABLE STRUCTURE =====
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sales_forecasts' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- ===== STEP 5: GET SHIPMENTS TABLE STRUCTURE =====
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'shipments' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- ===== STEP 6: GET ORGANIZATIONS TABLE STRUCTURE =====
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'organizations' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- ===== STEP 7: GET PRODUCTION FILES TABLE STRUCTURE =====
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'production_files' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- ===== STEP 8: CHECK WHAT DOCUMENT TABLES ACTUALLY EXIST =====
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name LIKE '%document%'
ORDER BY table_name;

-- ===== STEP 9: GET ACTUAL FOREIGN KEY RELATIONSHIPS =====
SELECT 
    tc.table_name as source_table,
    kcu.column_name as source_column,
    ccu.table_name as target_table,
    ccu.column_name as target_column,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ===== STEP 10: SAMPLE DATA FROM KEY TABLES =====

-- Sample invoices data
SELECT 
    id,
    invoice_number,
    customer_name,
    status,
    total_value,
    created_at
FROM invoices 
ORDER BY created_at DESC 
LIMIT 3;

-- Sample purchase orders data  
SELECT 
    id,
    purchase_order_number,
    supplier_name,
    organization_id,
    status,
    total_value,
    created_at
FROM purchase_orders 
ORDER BY created_at DESC 
LIMIT 3;

-- Sample sales forecasts data
SELECT 
    id,
    sku_id,
    delivery_week,
    quantity,
    sales_signal,
    factory_signal,
    custom_exw_date,
    created_by,
    created_at
FROM sales_forecasts 
ORDER BY created_at DESC 
LIMIT 3;




