-- =========================================================================
-- Bank Statements Table
-- =========================================================================
-- This table stores uploaded bank statement transactions for reconciliation
-- and matching with QuickBooks data

CREATE TABLE IF NOT EXISTS bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transaction Details
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  debit DECIMAL(15, 2) DEFAULT 0,
  credit DECIMAL(15, 2) DEFAULT 0,
  balance DECIMAL(15, 2),
  
  -- Bank Reference
  bank_transaction_number TEXT,
  check_number TEXT,
  
  -- Categorization
  category TEXT DEFAULT 'unassigned',
  -- Valid values: 'nre', 'inventory', 'opex', 'loans', 'investments', 'other', 'unassigned'
  gl_code_assignment TEXT, -- Assigned GL code from quickbooks_accounts
  high_level_category TEXT, -- For grouping: 'nre', 'inventory', 'opex', 'loans', etc.
  
  -- User Annotations
  notes TEXT,
  
  -- Matching to QuickBooks
  matched_qb_transaction_type TEXT, -- 'expense', 'bill', 'deposit', 'payment', 'bill_payment'
  matched_qb_transaction_id TEXT, -- Foreign key to respective QB table
  is_matched BOOLEAN DEFAULT FALSE,
  matched_at TIMESTAMPTZ,
  matched_by UUID, -- User who matched it
  
  -- Upload Tracking
  upload_batch_id UUID, -- Group transactions from same CSV upload
  uploaded_by UUID NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bank_statements_date 
  ON bank_statements(transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_bank_statements_category 
  ON bank_statements(category);

CREATE INDEX IF NOT EXISTS idx_bank_statements_batch 
  ON bank_statements(upload_batch_id);

CREATE INDEX IF NOT EXISTS idx_bank_statements_matched 
  ON bank_statements(is_matched);

CREATE INDEX IF NOT EXISTS idx_bank_statements_amount 
  ON bank_statements(debit, credit) WHERE debit > 0 OR credit > 0;

CREATE INDEX IF NOT EXISTS idx_bank_statements_qb_match 
  ON bank_statements(matched_qb_transaction_type, matched_qb_transaction_id) 
  WHERE is_matched = TRUE;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bank_statements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bank_statements_updated_at
  BEFORE UPDATE ON bank_statements
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_statements_updated_at();

-- Enable RLS
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role bypass (for API access)
-- Note: Access control is handled in API routes via canAccessQuickBooks feature flag
DROP POLICY IF EXISTS "Service role can access bank statements" ON bank_statements;
CREATE POLICY "Service role can access bank statements"
  ON bank_statements FOR ALL
  USING (true);

-- Comments for documentation
COMMENT ON TABLE bank_statements IS 'Stores uploaded bank statement transactions for reconciliation with QuickBooks';
COMMENT ON COLUMN bank_statements.transaction_date IS 'Date of the bank transaction';
COMMENT ON COLUMN bank_statements.debit IS 'Money withdrawn from account (negative cash flow)';
COMMENT ON COLUMN bank_statements.credit IS 'Money deposited to account (positive cash flow)';
COMMENT ON COLUMN bank_statements.category IS 'High-level category: nre, inventory, opex, loans, investments, other, unassigned';
COMMENT ON COLUMN bank_statements.matched_qb_transaction_type IS 'Type of QB transaction matched to: expense, bill, deposit, payment, bill_payment';
COMMENT ON COLUMN bank_statements.upload_batch_id IS 'Groups all transactions from the same CSV upload';

