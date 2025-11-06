-- ===== CASH FLOW BANK ACCOUNTS =====
-- This table stores bank account entries for each week, including beginning balance,
-- bank reconciliations, and other adjustments

-- Create enum for entry types (only if it doesn't already exist)
DO $$ BEGIN
  CREATE TYPE bank_account_entry_type AS ENUM (
    'beginning_balance',
    'bank_reconciliation',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create bank accounts table
CREATE TABLE IF NOT EXISTS cash_flow_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  entry_type bank_account_entry_type NOT NULL,
  description TEXT,
  amount NUMERIC(15, 2) NOT NULL,
  notes TEXT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cash_flow_bank_accounts_week_start 
  ON cash_flow_bank_accounts(week_start);
CREATE INDEX IF NOT EXISTS idx_cash_flow_bank_accounts_org_id 
  ON cash_flow_bank_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_bank_accounts_entry_type 
  ON cash_flow_bank_accounts(entry_type);

-- Enable RLS
ALTER TABLE cash_flow_bank_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view bank accounts for their organization" ON cash_flow_bank_accounts;
DROP POLICY IF EXISTS "Users can insert bank accounts for their organization" ON cash_flow_bank_accounts;
DROP POLICY IF EXISTS "Users can update bank accounts for their organization" ON cash_flow_bank_accounts;
DROP POLICY IF EXISTS "Users can delete bank accounts for their organization" ON cash_flow_bank_accounts;

-- RLS policies for cash_flow_bank_accounts
CREATE POLICY "Users can view bank accounts for their organization"
  ON cash_flow_bank_accounts
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert bank accounts for their organization"
  ON cash_flow_bank_accounts
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can update bank accounts for their organization"
  ON cash_flow_bank_accounts
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete bank accounts for their organization"
  ON cash_flow_bank_accounts
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT ALL ON cash_flow_bank_accounts TO authenticated;
GRANT ALL ON cash_flow_bank_accounts TO service_role;

