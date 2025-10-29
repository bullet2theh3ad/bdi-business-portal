-- Create enum for payment plan status
CREATE TYPE payment_plan_status AS ENUM ('draft', 'active');

-- Create enum for reference type
CREATE TYPE payment_reference_type AS ENUM ('po', 'shipment', 'other');

-- Create inventory payment plans table
CREATE TABLE IF NOT EXISTS inventory_payment_plans (
  id SERIAL PRIMARY KEY,
  plan_number VARCHAR(50) UNIQUE NOT NULL, -- e.g., PAY-2025-001
  name VARCHAR(255) NOT NULL,
  status payment_plan_status NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create inventory payment line items table
CREATE TABLE IF NOT EXISTS inventory_payment_line_items (
  id SERIAL PRIMARY KEY,
  payment_plan_id INTEGER NOT NULL REFERENCES inventory_payment_plans(id) ON DELETE CASCADE,
  description TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  payment_date DATE NOT NULL,
  reference VARCHAR(100), -- PO number, Shipment number, or other reference
  reference_type payment_reference_type NOT NULL DEFAULT 'other',
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_inventory_payment_plans_organization ON inventory_payment_plans(organization_id);
CREATE INDEX idx_inventory_payment_plans_created_by ON inventory_payment_plans(created_by);
CREATE INDEX idx_inventory_payment_plans_status ON inventory_payment_plans(status);
CREATE INDEX idx_inventory_payment_plans_plan_number ON inventory_payment_plans(plan_number);

CREATE INDEX idx_inventory_payment_line_items_plan ON inventory_payment_line_items(payment_plan_id);
CREATE INDEX idx_inventory_payment_line_items_date ON inventory_payment_line_items(payment_date);
CREATE INDEX idx_inventory_payment_line_items_is_paid ON inventory_payment_line_items(is_paid);
CREATE INDEX idx_inventory_payment_line_items_reference ON inventory_payment_line_items(reference);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_payment_plans_updated_at
  BEFORE UPDATE ON inventory_payment_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_payment_updated_at();

CREATE TRIGGER inventory_payment_line_items_updated_at
  BEFORE UPDATE ON inventory_payment_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_payment_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE inventory_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_payment_line_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view payment plans from their organization
CREATE POLICY inventory_payment_plans_select_policy ON inventory_payment_plans
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- Policy: Users can insert payment plans for their organization
CREATE POLICY inventory_payment_plans_insert_policy ON inventory_payment_plans
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- Policy: Users can update payment plans from their organization
CREATE POLICY inventory_payment_plans_update_policy ON inventory_payment_plans
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- Policy: Users can delete payment plans from their organization
CREATE POLICY inventory_payment_plans_delete_policy ON inventory_payment_plans
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- Policy: Users can view line items from their organization's payment plans
CREATE POLICY inventory_payment_line_items_select_policy ON inventory_payment_line_items
  FOR SELECT
  USING (
    payment_plan_id IN (
      SELECT id FROM inventory_payment_plans
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  );

-- Policy: Users can insert line items for their organization's payment plans
CREATE POLICY inventory_payment_line_items_insert_policy ON inventory_payment_line_items
  FOR INSERT
  WITH CHECK (
    payment_plan_id IN (
      SELECT id FROM inventory_payment_plans
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  );

-- Policy: Users can update line items from their organization's payment plans
CREATE POLICY inventory_payment_line_items_update_policy ON inventory_payment_line_items
  FOR UPDATE
  USING (
    payment_plan_id IN (
      SELECT id FROM inventory_payment_plans
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  );

-- Policy: Users can delete line items from their organization's payment plans
CREATE POLICY inventory_payment_line_items_delete_policy ON inventory_payment_line_items
  FOR DELETE
  USING (
    payment_plan_id IN (
      SELECT id FROM inventory_payment_plans
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  );

