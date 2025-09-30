-- Debug shipment factory assignment issue
-- Check why CBN selection results in MTN factory data

-- Check the specific shipment that's showing wrong factory
SELECT 
    s.id,
    s.shipment_number,
    s.organization_id,
    s.factory_warehouse_id,
    s.origin_warehouse_id,
    s.origin_custom_location,
    o.code as org_code,
    o.name as org_name,
    w.warehouse_code,
    w.name as warehouse_name
FROM shipments s
LEFT JOIN organizations o ON s.organization_id = o.id
LEFT JOIN warehouses w ON s.factory_warehouse_id = w.id
WHERE s.shipment_number = 'MNB1525-30B-U_2025-09-30'
ORDER BY s.created_at DESC;

-- Check all CBN warehouses/factories
SELECT 
    'CBN Warehouses/Factories:' as info,
    id,
    warehouse_code,
    name,
    organization_id
FROM warehouses 
WHERE name ILIKE '%compal%' OR name ILIKE '%cbn%' OR warehouse_code ILIKE '%cbn%'
ORDER BY name;

-- Check all MTN warehouses/factories  
SELECT 
    'MTN Warehouses/Factories:' as info,
    id,
    warehouse_code,
    name,
    organization_id
FROM warehouses 
WHERE name ILIKE '%mtn%' OR name ILIKE '%hua%' OR warehouse_code ILIKE '%mtn%'
ORDER BY name;

-- Check organization IDs for CBN and MTN
SELECT 
    'Organization IDs:' as info,
    id,
    code,
    name
FROM organizations 
WHERE code IN ('CBN', 'MTN')
ORDER BY code;
