-- Fix RLS policies for shipment_documents table
-- The issue: Users can upload to storage but can't insert into the database table

-- First, check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'shipment_documents';

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Users can only view their own shipment documents" ON shipment_documents;
DROP POLICY IF EXISTS "Users can only insert their own shipment documents" ON shipment_documents;
DROP POLICY IF EXISTS "Users can only delete their own shipment documents" ON shipment_documents;

-- Create comprehensive policies for shipment_documents
-- Allow BDI users (super_admin) to manage all shipment documents
CREATE POLICY "BDI users can manage all shipment documents"
ON shipment_documents
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
    INNER JOIN organizations o ON om.organization_uuid = o.id
    WHERE u.auth_id = auth.uid()
    AND o.code = 'BDI'
    AND u.role IN ('super_admin', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
    INNER JOIN organizations o ON om.organization_uuid = o.id
    WHERE u.auth_id = auth.uid()
    AND o.code = 'BDI'
    AND u.role IN ('super_admin', 'admin')
  )
);

-- Allow users to view/manage documents for shipments they have access to
CREATE POLICY "Users can manage documents for their shipments"
ON shipment_documents
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shipments s
    INNER JOIN users u ON u.auth_id = auth.uid()
    INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
    WHERE s.id = shipment_documents.shipment_id
    AND (
      s.organization_id = om.organization_uuid
      OR s.shipper_organization_id = om.organization_uuid
      OR s.destination_warehouse_id IN (
        SELECT id FROM warehouses WHERE organization_id = om.organization_uuid
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shipments s
    INNER JOIN users u ON u.auth_id = auth.uid()
    INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
    WHERE s.id = shipment_documents.shipment_id
    AND (
      s.organization_id = om.organization_uuid
      OR s.shipper_organization_id = om.organization_uuid
      OR s.destination_warehouse_id IN (
        SELECT id FROM warehouses WHERE organization_id = om.organization_uuid
      )
    )
  )
);

-- Verify the new policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'shipment_documents'
ORDER BY policyname;

