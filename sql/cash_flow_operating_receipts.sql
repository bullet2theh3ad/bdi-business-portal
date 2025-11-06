-- ===== CASH FLOW OPERATING RECEIPTS =====
-- This table stores operating cash receipts for each week, including
-- customer cash receipts from A/R aging and forecasted receipts

-- Create enum for receipt types (only if it doesn't already exist)
DO $$ BEGIN
  CREATE TYPE operating_receipt_type AS ENUM (
    'ar_aging',
    'ar_forecast',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create operating receipts table
CREATE TABLE IF NOT EXISTS cash_flow_operating_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  receipt_type operating_receipt_type NOT NULL,
  description TEXT,
  amount NUMERIC(15, 2) NOT NULL,
  source_reference VARCHAR(255),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cash_flow_operating_receipts_week_start 
  ON cash_flow_operating_receipts(week_start);
CREATE INDEX IF NOT EXISTS idx_cash_flow_operating_receipts_org_id 
  ON cash_flow_operating_receipts(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_operating_receipts_receipt_type 
  ON cash_flow_operating_receipts(receipt_type);

-- Enable RLS
ALTER TABLE cash_flow_operating_receipts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view operating receipts for their organization" ON cash_flow_operating_receipts;
DROP POLICY IF EXISTS "Users can insert operating receipts for their organization" ON cash_flow_operating_receipts;
DROP POLICY IF EXISTS "Users can update operating receipts for their organization" ON cash_flow_operating_receipts;
DROP POLICY IF EXISTS "Users can delete operating receipts for their organization" ON cash_flow_operating_receipts;

-- RLS policies for cash_flow_operating_receipts
CREATE POLICY "Users can view operating receipts for their organization"
  ON cash_flow_operating_receipts
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert operating receipts for their organization"
  ON cash_flow_operating_receipts
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can update operating receipts for their organization"
  ON cash_flow_operating_receipts
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete operating receipts for their organization"
  ON cash_flow_operating_receipts
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT ALL ON cash_flow_operating_receipts TO authenticated;
GRANT ALL ON cash_flow_operating_receipts TO service_role;

