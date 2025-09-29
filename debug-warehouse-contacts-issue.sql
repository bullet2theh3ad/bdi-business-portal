-- Debug warehouse contacts issue for Compal vs MTN
-- Check why Huan Zhua (MTN) appears when Compal warehouse is selected

-- Check all warehouses and their contacts
SELECT 
    id,
    warehouse_code,
    name,
    contact_name,
    contact_email,
    contact_phone,
    contacts,
    organization_id
FROM warehouses 
WHERE name ILIKE '%compal%' OR name ILIKE '%mtn%' OR warehouse_code ILIKE '%compal%'
ORDER BY name;

-- Check if there are any warehouses with Huan Zhua as contact
SELECT 
    id,
    warehouse_code,
    name,
    contact_name,
    contacts
FROM warehouses 
WHERE contact_name ILIKE '%huan%' OR contacts::text ILIKE '%huan%'
ORDER BY name;

-- Check if there's a default fallback contact being used
SELECT 
    'Warehouse Contact Assignments:' as info,
    warehouse_code,
    name,
    CASE 
        WHEN contacts IS NOT NULL AND contacts != '[]'::jsonb THEN 'Has contacts array'
        WHEN contact_name IS NOT NULL THEN 'Has legacy contact'
        ELSE 'No contact info'
    END as contact_status
FROM warehouses 
ORDER BY name;

-- Check organization assignments for warehouses
SELECT 
    w.warehouse_code,
    w.name as warehouse_name,
    o.code as org_code,
    o.name as org_name
FROM warehouses w
LEFT JOIN organizations o ON w.organization_id = o.id
WHERE w.name ILIKE '%compal%' OR w.name ILIKE '%mtn%'
ORDER BY w.name;

