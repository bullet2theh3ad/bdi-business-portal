-- ASK BDI QUERY FIXES NEEDED BASED ON SCHEMA ANALYSIS
-- Comparing current Ask BDI queries vs actual database schema

-- ISSUES IDENTIFIED FROM FOREIGN KEY ANALYSIS:

-- 1. PURCHASE ORDERS - FIXED ALREADY ✅
-- Current Ask BDI was using: po_number, delivery_date  
-- Correct fields: purchase_order_number, requested_delivery_date
-- Status: FIXED in recent commit

-- 2. INVOICE LINE ITEMS - POTENTIAL ISSUE
-- Ask BDI query uses: unit_price, total_price
-- Check actual field names:
SELECT 
  'INVOICE LINE ITEMS FIELD CHECK' as check_type,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'invoice_line_items'
  AND column_name IN ('unit_price', 'total_price', 'unit_cost', 'total_cost', 'line_total');

-- 3. PRODUCT SKUS - CHECK FIELD NAMES
-- Verify all SKU fields used in Ask BDI
SELECT 
  'PRODUCT SKUS FIELD CHECK' as check_type,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'product_skus'
  AND column_name IN (
    'sku', 'name', 'category', 'subcategory', 'mfg', 'moq', 
    'lead_time_days', 'unit_cost', 'box_weight_kg', 'carton_weight_kg',
    'is_active', 'is_discontinued'
  );

-- 4. SALES FORECASTS - VERIFY ALL CPFR FIELDS
SELECT 
  'SALES FORECASTS FIELD CHECK' as check_type,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'sales_forecasts'
  AND column_name IN (
    'id', 'sku_id', 'purchase_order_id', 'delivery_week', 'quantity',
    'confidence', 'shipping_preference', 'status', 'sales_signal',
    'factory_signal', 'shipping_signal', 'transit_signal', 'warehouse_signal',
    'created_by', 'created_at'
  );

-- 5. SHIPMENTS - CHECK ALL LOGISTICS FIELDS  
SELECT 
  'SHIPMENTS FIELD CHECK' as check_type,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'shipments'
  AND column_name IN (
    'id', 'shipment_number', 'forecast_id', 'organization_id',
    'origin_warehouse_id', 'destination_warehouse_id', 'shipper_organization_id',
    'status', 'estimated_departure', 'estimated_arrival', 'priority',
    'shipping_method', 'notes', 'created_by', 'created_at'
  );

-- 6. ORGANIZATIONS - VERIFY BUSINESS ENTITY FIELDS
SELECT 
  'ORGANIZATIONS FIELD CHECK' as check_type,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'organizations'
  AND column_name IN (
    'id', 'name', 'code', 'type', 'contact_email', 'contact_phone',
    'address', 'is_active', 'created_at'
  );

-- 7. WAREHOUSES - CHECK LOGISTICS FIELDS
SELECT 
  'WAREHOUSES FIELD CHECK' as check_type,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'warehouses'
  AND column_name IN (
    'id', 'name', 'warehouse_code', 'type', 'city', 'country',
    'capabilities', 'storage_capacity_sqm', 'organization_id', 'is_active'
  );

-- 8. CHECK FOR MISSING TABLES THAT ASK BDI MIGHT NEED
SELECT 
  'ADDITIONAL TABLES FOR ASK BDI' as check_type,
  table_name
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name NOT IN (
    'purchase_orders', 'purchase_order_line_items', 'sales_forecasts',
    'invoices', 'invoice_line_items', 'product_skus', 'shipments',
    'organizations', 'warehouses', 'users', 'organization_members'
  )
ORDER BY table_name;
