-- Create CBN warehouse/factory so CBN selection works correctly
-- This will fix the issue where CBN selection falls back to MTN factory

INSERT INTO warehouses (
    warehouse_code,
    name,
    type,
    address,
    city,
    state,
    country,
    postal_code,
    timezone,
    capabilities,
    operating_hours,
    contact_name,
    contact_email,
    contact_phone,
    contacts,
    max_pallet_height_cm,
    max_pallet_weight_kg,
    loading_dock_count,
    storage_capacity_sqm,
    is_active,
    notes,
    created_by,
    organization_id
) VALUES (
    'CBN-FACTORY',
    'Compal Business Networks Factory',
    'manufacturing',
    'TBD - Compal Factory Address',
    'TBD',
    NULL,
    'Taiwan',
    'TBD',
    'Asia/Taipei',
    '{"airFreight": true, "seaFreight": true, "truckLoading": true, "railAccess": false, "coldStorage": false, "hazmatHandling": false}'::jsonb,
    '8:00 AM - 6:00 PM Taiwan Time',
    'CBN Factory Contact',
    'factory@compal.com',
    '+886-XXX-XXXX',
    '[
        {
            "name": "CBN Factory Contact",
            "email": "factory@compal.com",
            "phone": "+886-XXX-XXXX",
            "extension": "",
            "isPrimary": true
        }
    ]'::jsonb,
    180,
    1000,
    2,
    5000,
    true,
    'Compal Business Networks manufacturing facility',
    '18a29c7a-3778-4ea9-a36b-eefabb93d1a3', -- Steven's auth ID
    'e33c89bf-cc1a-42ef-bbdf-6d939e052656'  -- CBN organization ID
);

-- Verify the CBN warehouse was created
SELECT 
    'CBN Warehouse Created:' as status,
    id,
    warehouse_code,
    name,
    organization_id
FROM warehouses 
WHERE warehouse_code = 'CBN-FACTORY';

-- Show both warehouses now available
SELECT 
    'Available Factories:' as info,
    warehouse_code,
    name,
    o.code as org_code
FROM warehouses w
LEFT JOIN organizations o ON w.organization_id = o.id
WHERE warehouse_code IN ('CBN-FACTORY', 'MTN-FACTORY')
ORDER BY warehouse_code;
