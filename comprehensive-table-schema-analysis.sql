-- COMPREHENSIVE TABLE SCHEMA ANALYSIS FOR ASK BDI DATA GATHERING
-- This will provide complete field names and structures for accurate queries

-- 1. GET ALL TABLES IN THE DATABASE
SELECT 
  'ALL TABLES IN DATABASE' as analysis_type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. COMPLETE SCHEMA FOR ALL CPFR-RELATED TABLES
-- Purchase Orders Table Schema
SELECT 
  'PURCHASE_ORDERS SCHEMA' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'purchase_orders'
ORDER BY ordinal_position;

-- Purchase Order Line Items Schema
SELECT 
  'PURCHASE_ORDER_LINE_ITEMS SCHEMA' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'purchase_order_line_items'
ORDER BY ordinal_position;

-- Sales Forecasts Schema
SELECT 
  'SALES_FORECASTS SCHEMA' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'sales_forecasts'
ORDER BY ordinal_position;

-- Invoices Schema
SELECT 
  'INVOICES SCHEMA' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

-- Invoice Line Items Schema
SELECT 
  'INVOICE_LINE_ITEMS SCHEMA' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'invoice_line_items'
ORDER BY ordinal_position;

-- Product SKUs Schema
SELECT 
  'PRODUCT_SKUS SCHEMA' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'product_skus'
ORDER BY ordinal_position;

-- Shipments Schema
SELECT 
  'SHIPMENTS SCHEMA' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'shipments'
ORDER BY ordinal_position;

-- Organizations Schema
SELECT 
  'ORGANIZATIONS SCHEMA' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'organizations'
ORDER BY ordinal_position;

-- Warehouses Schema
SELECT 
  'WAREHOUSES SCHEMA' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'warehouses'
ORDER BY ordinal_position;

-- Users Schema
SELECT 
  'USERS SCHEMA' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Organization Members Schema
SELECT 
  'ORGANIZATION_MEMBERS SCHEMA' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'organization_members'
ORDER BY ordinal_position;

-- EMG Inventory Schema
SELECT 
  'EMG_INVENTORY SCHEMA' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'emg_inventory'
ORDER BY ordinal_position;

-- CATV Inventory Schema
SELECT 
  'CATV_INVENTORY_TRACKING SCHEMA' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'catv_inventory_tracking'
ORDER BY ordinal_position;

-- RAG Documents Schema
SELECT 
  'RAG_DOCUMENTS SCHEMA' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'rag_documents'
ORDER BY ordinal_position;

-- 3. SAMPLE DATA FROM KEY TABLES TO VERIFY STRUCTURE
-- Sample Purchase Orders
SELECT 
  'SAMPLE PURCHASE ORDERS' as data_type,
  id,
  purchase_order_number,
  supplier_name,
  total_value,
  status,
  purchase_order_date,
  requested_delivery_date,
  organization_id
FROM purchase_orders
ORDER BY created_at DESC
LIMIT 5;

-- Sample PO Line Items
SELECT 
  'SAMPLE PO LINE ITEMS' as data_type,
  poli.purchase_order_id,
  po.purchase_order_number,
  poli.sku_id,
  poli.sku_code,
  poli.sku_name,
  poli.quantity,
  poli.unit_cost,
  poli.total_cost
FROM purchase_order_line_items poli
JOIN purchase_orders po ON poli.purchase_order_id = po.id
ORDER BY po.created_at DESC
LIMIT 10;

-- Sample Product SKUs
SELECT 
  'SAMPLE PRODUCT SKUS' as data_type,
  id,
  sku,
  name,
  category,
  subcategory,
  mfg,
  moq,
  lead_time_days,
  unit_cost,
  box_weight_kg,
  is_active
FROM product_skus
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 10;

-- Sample Sales Forecasts
SELECT 
  'SAMPLE SALES FORECASTS' as data_type,
  id,
  sku_id,
  purchase_order_id,
  delivery_week,
  quantity,
  confidence,
  shipping_preference,
  status,
  sales_signal,
  factory_signal,
  shipping_signal
FROM sales_forecasts
ORDER BY created_at DESC
LIMIT 5;

-- Sample Invoices
SELECT 
  'SAMPLE INVOICES' as data_type,
  id,
  invoice_number,
  customer_name,
  total_value,
  status,
  invoice_date,
  requested_delivery_week,
  terms
FROM invoices
ORDER BY created_at DESC
LIMIT 5;

-- 4. FOREIGN KEY RELATIONSHIPS
SELECT 
  'FOREIGN KEY RELATIONSHIPS' as analysis_type,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'purchase_orders', 'purchase_order_line_items', 'sales_forecasts', 
    'invoices', 'invoice_line_items', 'product_skus', 'shipments',
    'organizations', 'warehouses', 'users', 'organization_members'
  )
ORDER BY tc.table_name, kcu.column_name;
