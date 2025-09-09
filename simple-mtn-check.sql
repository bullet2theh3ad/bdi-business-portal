-- Simple check for MTN data

-- 1. MTN Organization
SELECT 'MTN ORG' as check_type, id, code, name, type FROM organizations WHERE code = 'MTN';

-- 2. All Purchase Orders
SELECT 'ALL POS' as check_type, id, purchase_order_number, supplier_name, organization_id, status FROM purchase_orders LIMIT 5;

-- 3. MTN Purchase Orders
SELECT 'MTN POS' as check_type, id, purchase_order_number, supplier_name FROM purchase_orders WHERE supplier_name = 'MTN';

-- 4. All Warehouses  
SELECT 'ALL WAREHOUSES' as check_type, warehouse_code, name, organization_id FROM warehouses;

-- 5. EMG Warehouse specifically
SELECT 'EMG WAREHOUSE' as check_type, warehouse_code, name, organization_id FROM warehouses WHERE warehouse_code = 'EMG';
