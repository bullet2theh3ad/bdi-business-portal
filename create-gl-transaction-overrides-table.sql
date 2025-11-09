-- =========================================================================
-- GL Transaction Overrides Table
-- =========================================================================
-- This table stores user modifications to QuickBooks and bank transactions
-- Allows re-categorization, notes, and bank transaction number assignment

CREATE TABLE IF NOT EXISTS gl_transaction_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transaction Reference
  transaction_source TEXT NOT NULL,
  -- Valid values: 'expense', 'bill', 'deposit', 'payment', 'bill_payment', 'bank_statement'
  transaction_id TEXT NOT NULL, -- QB ID or bank statement UUID
  
  -- Line Item Reference (for QB transactions with multiple line items)
  line_item_index INTEGER, -- NULL for document-level overrides
  
  -- Category Overrides
  original_category TEXT,
  override_category TEXT,
  -- Valid categories: 'nre', 'inventory', 'opex', 'labor', 'loans', 'investments', 'revenue', 'other', 'unassigned'
  
  -- GL Code Override
  original_gl_code TEXT,
  assigned_gl_code TEXT, -- Override GL code assignment
  
  -- User Annotations
  notes TEXT,
  bank_transaction_number TEXT,
  
  -- Description Override
  original_description TEXT,
  override_description TEXT,
  
  -- Amount Adjustments (for split transactions)
  original_amount DECIMAL(15, 2),
  adjusted_amount DECIMAL(15, 2),
  
  -- Metadata
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one override per transaction+line item combination
  UNIQUE(transaction_source, transaction_id, line_item_index)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gl_overrides_transaction 
  ON gl_transaction_overrides(transaction_source, transaction_id);

CREATE INDEX IF NOT EXISTS idx_gl_overrides_category 
  ON gl_transaction_overrides(override_category);

CREATE INDEX IF NOT EXISTS idx_gl_overrides_gl_code 
  ON gl_transaction_overrides(assigned_gl_code);

CREATE INDEX IF NOT EXISTS idx_gl_overrides_created_by 
  ON gl_transaction_overrides(created_by);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_gl_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gl_overrides_updated_at
  BEFORE UPDATE ON gl_transaction_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_gl_overrides_updated_at();

-- Enable RLS
ALTER TABLE gl_transaction_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role bypass (for API access)
-- Note: Access control is handled in API routes via canAccessQuickBooks feature flag
DROP POLICY IF EXISTS "Service role can access gl overrides" ON gl_transaction_overrides;
CREATE POLICY "Service role can access gl overrides"
  ON gl_transaction_overrides FOR ALL
  USING (true);

-- Comments for documentation
COMMENT ON TABLE gl_transaction_overrides IS 'Stores user modifications to QuickBooks and bank transactions';
COMMENT ON COLUMN gl_transaction_overrides.transaction_source IS 'Type: expense, bill, deposit, payment, bill_payment, bank_statement';
COMMENT ON COLUMN gl_transaction_overrides.transaction_id IS 'QB transaction ID or bank statement UUID';
COMMENT ON COLUMN gl_transaction_overrides.line_item_index IS 'Index of line item within transaction (NULL for document-level)';
COMMENT ON COLUMN gl_transaction_overrides.override_category IS 'Re-categorized as: nre, inventory, opex, labor, loans, investments, revenue, other, unassigned';
COMMENT ON COLUMN gl_transaction_overrides.assigned_gl_code IS 'Manually assigned GL code overriding original';

