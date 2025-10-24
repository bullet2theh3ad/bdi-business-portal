-- =============================================
-- QuickBooks High Priority Tables Migration
-- Adds: Estimates, Journal Entries, Accounts
-- =============================================

-- =============================================
-- 1. QuickBooks Estimates Table
-- =============================================
CREATE TABLE IF NOT EXISTS quickbooks_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_estimate_id TEXT NOT NULL,
  qb_sync_token TEXT,
  qb_doc_number TEXT,
  
  -- Customer Reference
  qb_customer_id TEXT,
  customer_name TEXT,
  
  -- Dates
  txn_date DATE,
  expiration_date DATE,
  accepted_date DATE,
  
  -- Amounts
  total_amount DECIMAL(15, 2) DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  
  -- Status
  status TEXT, -- Accepted, Closed, Pending, Rejected
  email_status TEXT,
  print_status TEXT,
  
  -- Billing Address
  bill_email TEXT,
  billing_address JSONB,
  shipping_address JSONB,
  
  -- Memo/Notes
  customer_memo TEXT,
  private_note TEXT,
  
  -- Line Items (stored as JSON for flexibility)
  line_items JSONB,
  
  -- Full QB data for reference
  full_data JSONB,
  
  -- Metadata
  qb_created_at TIMESTAMP WITH TIME ZONE,
  qb_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(connection_id, qb_estimate_id)
);

-- Indexes for estimates
CREATE INDEX IF NOT EXISTS idx_qb_estimates_connection ON quickbooks_estimates(connection_id);
CREATE INDEX IF NOT EXISTS idx_qb_estimates_customer ON quickbooks_estimates(qb_customer_id);
CREATE INDEX IF NOT EXISTS idx_qb_estimates_txn_date ON quickbooks_estimates(txn_date);
CREATE INDEX IF NOT EXISTS idx_qb_estimates_status ON quickbooks_estimates(status);
CREATE INDEX IF NOT EXISTS idx_qb_estimates_updated ON quickbooks_estimates(qb_updated_at);

-- RLS for estimates
ALTER TABLE quickbooks_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view QB estimates"
  ON quickbooks_estimates FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- =============================================
-- 2. QuickBooks Journal Entries Table
-- =============================================
CREATE TABLE IF NOT EXISTS quickbooks_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_journal_entry_id TEXT NOT NULL,
  qb_sync_token TEXT,
  qb_doc_number TEXT,
  
  -- Transaction Details
  txn_date DATE,
  
  -- Amounts
  total_amount DECIMAL(15, 2) DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  
  -- Adjustment flag
  adjustment BOOLEAN DEFAULT FALSE,
  
  -- Memo/Notes
  private_note TEXT,
  
  -- Line Items (debits and credits stored as JSON)
  line_items JSONB,
  
  -- Full QB data for reference
  full_data JSONB,
  
  -- Metadata
  qb_created_at TIMESTAMP WITH TIME ZONE,
  qb_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(connection_id, qb_journal_entry_id)
);

-- Indexes for journal entries
CREATE INDEX IF NOT EXISTS idx_qb_journal_entries_connection ON quickbooks_journal_entries(connection_id);
CREATE INDEX IF NOT EXISTS idx_qb_journal_entries_txn_date ON quickbooks_journal_entries(txn_date);
CREATE INDEX IF NOT EXISTS idx_qb_journal_entries_updated ON quickbooks_journal_entries(qb_updated_at);
CREATE INDEX IF NOT EXISTS idx_qb_journal_entries_adjustment ON quickbooks_journal_entries(adjustment);

-- RLS for journal entries
ALTER TABLE quickbooks_journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view QB journal entries"
  ON quickbooks_journal_entries FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- =============================================
-- 3. QuickBooks Accounts Table (Chart of Accounts)
-- =============================================
CREATE TABLE IF NOT EXISTS quickbooks_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_account_id TEXT NOT NULL,
  qb_sync_token TEXT,
  
  -- Account Details
  name TEXT NOT NULL,
  fully_qualified_name TEXT,
  account_number TEXT,
  
  -- Account Type
  account_type TEXT, -- Bank, Accounts Receivable, Other Current Asset, Fixed Asset, etc.
  account_sub_type TEXT, -- CashOnHand, Checking, Savings, etc.
  classification TEXT, -- Asset, Liability, Equity, Revenue, Expense
  
  -- Account Hierarchy
  parent_ref TEXT, -- Parent account ID
  sub_account BOOLEAN DEFAULT FALSE,
  account_level INTEGER, -- Depth in hierarchy
  
  -- Balances
  current_balance DECIMAL(15, 2) DEFAULT 0,
  current_balance_with_sub_accounts DECIMAL(15, 2) DEFAULT 0,
  
  -- Currency
  currency_code TEXT DEFAULT 'USD',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Description
  description TEXT,
  
  -- Tax Info
  tax_code_ref TEXT,
  
  -- Full QB data for reference
  full_data JSONB,
  
  -- Metadata
  qb_created_at TIMESTAMP WITH TIME ZONE,
  qb_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(connection_id, qb_account_id)
);

-- Indexes for accounts
CREATE INDEX IF NOT EXISTS idx_qb_accounts_connection ON quickbooks_accounts(connection_id);
CREATE INDEX IF NOT EXISTS idx_qb_accounts_type ON quickbooks_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_qb_accounts_sub_type ON quickbooks_accounts(account_sub_type);
CREATE INDEX IF NOT EXISTS idx_qb_accounts_classification ON quickbooks_accounts(classification);
CREATE INDEX IF NOT EXISTS idx_qb_accounts_parent ON quickbooks_accounts(parent_ref);
CREATE INDEX IF NOT EXISTS idx_qb_accounts_active ON quickbooks_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_qb_accounts_updated ON quickbooks_accounts(qb_updated_at);
CREATE INDEX IF NOT EXISTS idx_qb_accounts_name ON quickbooks_accounts(name);

-- RLS for accounts
ALTER TABLE quickbooks_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view QB accounts"
  ON quickbooks_accounts FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- =============================================
-- Comments
-- =============================================
COMMENT ON TABLE quickbooks_estimates IS 'Customer quotes/proposals from QuickBooks';
COMMENT ON TABLE quickbooks_journal_entries IS 'Manual accounting adjustments and journal entries from QuickBooks';
COMMENT ON TABLE quickbooks_accounts IS 'Chart of Accounts from QuickBooks';

COMMENT ON COLUMN quickbooks_estimates.status IS 'Estimate status: Accepted, Closed, Pending, Rejected';
COMMENT ON COLUMN quickbooks_journal_entries.adjustment IS 'Whether this is an adjusting journal entry';
COMMENT ON COLUMN quickbooks_accounts.account_type IS 'QuickBooks account type (Bank, Accounts Receivable, etc.)';
COMMENT ON COLUMN quickbooks_accounts.classification IS 'High-level classification: Asset, Liability, Equity, Revenue, Expense';

