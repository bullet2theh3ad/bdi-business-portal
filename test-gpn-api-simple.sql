-- Test GPN API access step by step
-- Let's manually check what files GPN should be able to access

-- Step 1: GPN's organization ID
SELECT 'GPN Organization:' as step, id, code, name FROM organizations WHERE code = 'GPN';

-- Step 2: Organizations GPN can access (based on connections)
SELECT 
    'GPN Can Access:' as step,
    target_org.code,
    target_org.name,
    oc.permissions->'canViewFiles' as can_view_files
FROM organization_connections oc
JOIN organizations source_org ON oc.source_organization_id = source_org.id
JOIN organizations target_org ON oc.target_organization_id = target_org.id
WHERE source_org.code = 'GPN' 
    AND oc.status = 'active'
    AND oc.permissions->>'canViewFiles' = 'true';

-- Step 3: Count files from accessible organizations
SELECT 
    'Files GPN Should See:' as step,
    o.code as org_code,
    COUNT(*) as file_count
FROM production_files pf
JOIN organizations o ON pf.organization_id = o.id
WHERE o.id IN (
    -- GPN's own org
    'b93954ef-f856-406b-9e8f-3236a7ae0f90'
    UNION
    -- Organizations GPN can access
    SELECT oc.target_organization_id
    FROM organization_connections oc
    WHERE oc.source_organization_id = 'b93954ef-f856-406b-9e8f-3236a7ae0f90'
        AND oc.status = 'active'
        AND oc.permissions->>'canViewFiles' = 'true'
)
GROUP BY o.code, o.name
ORDER BY file_count DESC;
