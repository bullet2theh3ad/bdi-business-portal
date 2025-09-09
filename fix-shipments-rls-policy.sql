-- FIX: Update shipments RLS policy to allow CPFR cross-organization access
-- Current policy only allows users to see shipments from their own organization
-- But CPFR requires partners (MTN) to see shipments for their SKUs/forecasts

-- 1. Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view shipments from their organization" ON shipments;
DROP POLICY IF EXISTS "Users can manage shipments for their organization" ON shipments;

-- 2. Create new policy that allows CPFR cross-organization access
-- Users can see shipments if:
-- a) The shipment belongs to their organization (original logic), OR
-- b) The shipment is for a forecast of a SKU they can access via invoices (CPFR logic)

CREATE POLICY "Users can view CPFR shipments" ON shipments
FOR SELECT
USING (
  -- Original: Own organization shipments
  organization_id IN (
    SELECT organization_members.organization_uuid
    FROM organization_members
    WHERE organization_members.user_auth_id = auth.uid()
  )
  OR
  -- CPFR: Shipments for forecasts of SKUs accessible via invoices
  forecast_id IN (
    SELECT sf.id 
    FROM sales_forecasts sf
    INNER JOIN invoice_line_items ili ON sf.sku_id = ili.sku_id
    INNER JOIN invoices inv ON ili.invoice_id = inv.id
    INNER JOIN organization_members om ON om.user_auth_id = auth.uid()
    INNER JOIN organizations org ON om.organization_uuid = org.id
    WHERE inv.customer_name = org.code
  )
);

CREATE POLICY "Users can manage CPFR shipments" ON shipments
FOR ALL
USING (
  -- Original: Own organization shipments
  organization_id IN (
    SELECT organization_members.organization_uuid
    FROM organization_members
    WHERE organization_members.user_auth_id = auth.uid()
  )
  OR
  -- CPFR: Shipments for forecasts of SKUs accessible via invoices
  forecast_id IN (
    SELECT sf.id 
    FROM sales_forecasts sf
    INNER JOIN invoice_line_items ili ON sf.sku_id = ili.sku_id
    INNER JOIN invoices inv ON ili.invoice_id = inv.id
    INNER JOIN organization_members om ON om.user_auth_id = auth.uid()
    INNER JOIN organizations org ON om.organization_uuid = org.id
    WHERE inv.customer_name = org.code
  )
);

-- 3. Verify the new policies
SELECT 
  'NEW RLS POLICIES' as status,
  schemaname, 
  tablename, 
  policyname, 
  cmd,
  LEFT(qual, 100) || '...' as policy_logic
FROM pg_policies 
WHERE tablename = 'shipments';
