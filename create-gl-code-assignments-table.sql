-- =========================================================================
-- GL Code Category Assignments Table
-- =========================================================================
-- This table stores user-defined category assignments for QuickBooks GL codes
-- Used for cash flow analysis categorization

CREATE TABLE IF NOT EXISTS gl_code_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- QuickBooks Account Reference
  qb_account_id TEXT NOT NULL UNIQUE,
  
  -- Category Assignment
  category TEXT NOT NULL DEFAULT 'unassigned',
  -- Valid values: 'opex', 'cogs', 'inventory', 'nre', 'ignore', 'unassigned'
  
  -- Cash Flow Settings
  include_in_cash_flow BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT gl_code_assignments_category_check 
    CHECK (category IN ('opex', 'cogs', 'inventory', 'nre', 'ignore', 'unassigned'))
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_gl_code_assignments_qb_account_id 
  ON gl_code_assignments(qb_account_id);

CREATE INDEX IF NOT EXISTS idx_gl_code_assignments_category 
  ON gl_code_assignments(category);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_gl_code_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gl_code_assignments_updated_at
  BEFORE UPDATE ON gl_code_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_gl_code_assignments_updated_at();

-- Comments for documentation
COMMENT ON TABLE gl_code_assignments IS 'Stores category assignments for QuickBooks GL codes for cash flow analysis';
COMMENT ON COLUMN gl_code_assignments.qb_account_id IS 'QuickBooks Account ID from quickbooks_accounts table';
COMMENT ON COLUMN gl_code_assignments.category IS 'Category for cash flow analysis: opex, cogs, inventory, nre, ignore, unassigned';
COMMENT ON COLUMN gl_code_assignments.include_in_cash_flow IS 'Whether to include this GL code in cash flow calculations';

