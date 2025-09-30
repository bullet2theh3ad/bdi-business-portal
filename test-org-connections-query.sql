-- Test the exact query the API is trying to run
-- This should match what the production files API is doing

SELECT 
    target_organization_id,
    permissions
FROM organization_connections
WHERE source_organization_id = 'b93954ef-f856-406b-9e8f-3236a7ae0f90'
    AND status = 'active';
