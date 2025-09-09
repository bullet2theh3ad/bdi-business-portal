-- Check purchase orders and their supplier assignments for MTN access

-- Show all purchase orders with their organizations
SELECT 
    'ALL PURCHASE ORDERS' as status,
    po.id,
    po.purchase_order_number,
    po.supplier_name,
    po.custom_supplier_name,
    po.status,
    po.total_value,
    o.code as buyer_org_code,
    o.name as buyer_org_name,
    po.created_at
FROM purchase_orders po
LEFT JOIN organizations o ON po.organization_id = o.id
ORDER BY po.created_at DESC;

-- Check MTN organization details
SELECT 
    'MTN ORGANIZATION' as status,
    id,
    code,
    name,
    type
FROM organizations 
WHERE code = 'MTN';

-- Check what POs MTN should see (as buyer or supplier)
SELECT 
    'MTN AS BUYER' as status,
    po.purchase_order_number,
    po.supplier_name,
    po.status,
    po.total_value
FROM purchase_orders po
JOIN organizations o ON po.organization_id = o.id
WHERE o.code = 'MTN';

SELECT 
    'MTN AS SUPPLIER' as status,
    po.purchase_order_number,
    po.supplier_name,
    po.status,
    po.total_value,
    o.code as buyer_org
FROM purchase_orders po
LEFT JOIN organizations o ON po.organization_id = o.id
WHERE po.supplier_name = 'MTN';

-- Show supplier name variations that might exist
SELECT 
    'SUPPLIER NAME VARIATIONS' as status,
    supplier_name,
    COUNT(*) as po_count
FROM purchase_orders
GROUP BY supplier_name
ORDER BY supplier_name;
