-- DEBUG: MTN Connection Permissions
-- Check what connections MTN has and what permissions are set

SELECT 
  'MTN CONNECTIONS' as status,
  oc.id,
  oc.source_organization_code,
  oc.target_organization_code,
  oc.connection_type,
  oc.status,
  oc.permissions,
  so.name as source_org_name,
  to2.name as target_org_name
FROM organization_connections oc
JOIN organizations so ON oc.source_organization_code = so.code
JOIN organizations to2 ON oc.target_organization_code = to2.code
WHERE oc.source_organization_code = 'MTN' 
   OR oc.target_organization_code = 'MTN'
ORDER BY oc.created_at;

-- Check what specific permissions MTN has
SELECT 
  'MTN PERMISSION DETAILS' as status,
  oc.source_organization_code as from_org,
  oc.target_organization_code as to_org,
  oc.permissions->>'canViewPartnerData' as can_view_partner,
  oc.permissions->>'canViewInternalData' as can_view_internal,
  oc.permissions->>'canViewPublicData' as can_view_public,
  oc.permissions->>'canViewFiles' as can_view_files,
  oc.permissions->>'canDownloadFiles' as can_download_files
FROM organization_connections oc
WHERE oc.source_organization_code = 'MTN' 
   OR oc.target_organization_code = 'MTN';

-- Check if there are warehouses that MTN should see
SELECT 
  'ALL WAREHOUSES' as status,
  w.warehouse_code,
  w.name,
  w.organization_id,
  o.code as org_code,
  o.name as org_name,
  o.type as org_type
FROM warehouses w
JOIN organizations o ON w.organization_id = o.id
ORDER BY o.code, w.warehouse_code;

-- Check purchase orders that MTN should see
SELECT 
  'PURCHASE ORDERS FOR MTN' as status,
  po.id,
  po.po_number,
  po.supplier_name,
  po.organization_id,
  o.code as buyer_org_code,
  o.name as buyer_org_name,
  po.status,
  po.total_amount
FROM purchase_orders po
JOIN organizations o ON po.organization_id = o.id
WHERE po.supplier_name = 'MTN' 
   OR o.code = 'MTN'
ORDER BY po.created_at DESC;
