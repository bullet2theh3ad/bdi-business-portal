-- ============================================================================
-- CREATE TABLE: ramp_transactions
-- ============================================================================
-- This table stores Ramp Register transactions uploaded from XLS files
-- Similar to bank_statements but specific to Ramp credit card data

CREATE TABLE IF NOT EXISTS ramp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transaction Details
  transaction_date DATE NOT NULL,
  ref_no TEXT,
  payee TEXT,
  memo TEXT,
  class TEXT,
  foreign_currency TEXT,
  charge_usd DECIMAL(15, 2),
  payment_usd DECIMAL(15, 2),
  reconciliation_status TEXT,
  balance_usd DECIMAL(15, 2),
  type TEXT,
  account TEXT,
  store TEXT,
  exchange_rate TEXT,
  added_in_banking TEXT,
  
  -- Categorization (user-defined)
  category TEXT DEFAULT 'unassigned',
  account_type TEXT DEFAULT 'Unclassified',
  notes TEXT,
  
  -- Matching with QuickBooks
  is_matched BOOLEAN DEFAULT false,
  matched_qb_transaction_id TEXT,
  matched_at TIMESTAMP,
  matched_by UUID,
  
  -- Upload tracking
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID,
  original_line TEXT, -- Store the original line for reference
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ramp_transactions_date ON ramp_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_ramp_transactions_category ON ramp_transactions(category);
CREATE INDEX IF NOT EXISTS idx_ramp_transactions_payee ON ramp_transactions(payee);
CREATE INDEX IF NOT EXISTS idx_ramp_transactions_uploaded_by ON ramp_transactions(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_ramp_transactions_is_matched ON ramp_transactions(is_matched);

-- Add comments
COMMENT ON TABLE ramp_transactions IS 'Ramp Register transactions uploaded from XLS files for GL categorization and reconciliation';
COMMENT ON COLUMN ramp_transactions.transaction_date IS 'Transaction date from Ramp Register';
COMMENT ON COLUMN ramp_transactions.ref_no IS 'Reference number from Ramp';
COMMENT ON COLUMN ramp_transactions.payee IS 'Payee/vendor name';
COMMENT ON COLUMN ramp_transactions.memo IS 'Transaction memo/description';
COMMENT ON COLUMN ramp_transactions.charge_usd IS 'Charge amount in USD (positive for expenses)';
COMMENT ON COLUMN ramp_transactions.payment_usd IS 'Payment amount in USD (positive for payments)';
COMMENT ON COLUMN ramp_transactions.category IS 'User-assigned category (nre, inventory, opex, etc.)';
COMMENT ON COLUMN ramp_transactions.account_type IS 'User-assigned account type (Contract, Services, etc.)';
COMMENT ON COLUMN ramp_transactions.is_matched IS 'Whether this transaction has been matched to QuickBooks';
COMMENT ON COLUMN ramp_transactions.original_line IS 'Original line from uploaded file for reference';

-- Enable Row Level Security
ALTER TABLE ramp_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow service role full access
CREATE POLICY "Allow service role full access to ramp_transactions"
  ON ramp_transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON ramp_transactions TO service_role;

