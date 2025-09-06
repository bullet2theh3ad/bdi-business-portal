-- Check CBN organization setup
SELECT 
    id,
    code,
    name,
    is_active,
    created_at,
    type
FROM organizations 
WHERE code = 'CBN';

-- Check if CBN has any users
SELECT 
    u.name,
    u.email,
    u.role,
    u.is_active,
    om.role as membership_role
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE o.code = 'CBN';

-- Check if CBN has any invoices or POs (context for file uploads)
SELECT 'Invoices' as type, COUNT(*) as count FROM invoices WHERE customer_name = 'CBN'
UNION ALL
SELECT 'Purchase Orders', COUNT(*) FROM purchase_orders WHERE supplier_name = 'CBN';

-- Check organization_connections for CBN (file access permissions)
SELECT 
    oc.*
FROM organization_connections oc
JOIN organizations o1 ON oc.organization_id = o1.id
JOIN organizations o2 ON oc.connected_organization_id = o2.id
WHERE o1.code = 'CBN' OR o2.code = 'CBN';
