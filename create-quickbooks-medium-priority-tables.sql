-- =============================================
-- QuickBooks Medium Priority Tables Migration
-- Adds: VendorCredit, RefundReceipt, Transfer, Class, Term
-- =============================================

-- =============================================
-- 1. QuickBooks Vendor Credits Table
-- =============================================
CREATE TABLE IF NOT EXISTS quickbooks_vendor_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_vendor_credit_id TEXT NOT NULL,
  qb_sync_token TEXT,
  qb_doc_number TEXT,
  
  -- Vendor Reference
  qb_vendor_id TEXT,
  vendor_name TEXT,
  
  -- Dates
  txn_date DATE,
  
  -- Amounts
  total_amount DECIMAL(15, 2) DEFAULT 0,
  remaining_credit DECIMAL(15, 2) DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  
  -- AP Account
  ap_account_ref TEXT,
  
  -- Memo/Notes
  memo TEXT,
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
  UNIQUE(connection_id, qb_vendor_credit_id)
);

-- Indexes for vendor credits
CREATE INDEX IF NOT EXISTS idx_qb_vendor_credits_connection ON quickbooks_vendor_credits(connection_id);
CREATE INDEX IF NOT EXISTS idx_qb_vendor_credits_vendor ON quickbooks_vendor_credits(qb_vendor_id);
CREATE INDEX IF NOT EXISTS idx_qb_vendor_credits_txn_date ON quickbooks_vendor_credits(txn_date);
CREATE INDEX IF NOT EXISTS idx_qb_vendor_credits_updated ON quickbooks_vendor_credits(qb_updated_at);

-- RLS for vendor credits
ALTER TABLE quickbooks_vendor_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view QB vendor credits"
  ON quickbooks_vendor_credits FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- =============================================
-- 2. QuickBooks Refund Receipts Table
-- =============================================
CREATE TABLE IF NOT EXISTS quickbooks_refund_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_refund_receipt_id TEXT NOT NULL,
  qb_sync_token TEXT,
  qb_doc_number TEXT,
  
  -- Customer Reference
  qb_customer_id TEXT,
  customer_name TEXT,
  
  -- Dates
  txn_date DATE,
  
  -- Amounts
  total_amount DECIMAL(15, 2) DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  
  -- Payment Info
  payment_method_ref TEXT,
  payment_ref_number TEXT,
  deposit_to_account_ref TEXT,
  
  -- Billing Address
  bill_email TEXT,
  billing_address JSONB,
  
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
  UNIQUE(connection_id, qb_refund_receipt_id)
);

-- Indexes for refund receipts
CREATE INDEX IF NOT EXISTS idx_qb_refund_receipts_connection ON quickbooks_refund_receipts(connection_id);
CREATE INDEX IF NOT EXISTS idx_qb_refund_receipts_customer ON quickbooks_refund_receipts(qb_customer_id);
CREATE INDEX IF NOT EXISTS idx_qb_refund_receipts_txn_date ON quickbooks_refund_receipts(txn_date);
CREATE INDEX IF NOT EXISTS idx_qb_refund_receipts_updated ON quickbooks_refund_receipts(qb_updated_at);

-- RLS for refund receipts
ALTER TABLE quickbooks_refund_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view QB refund receipts"
  ON quickbooks_refund_receipts FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- =============================================
-- 3. QuickBooks Transfers Table
-- =============================================
CREATE TABLE IF NOT EXISTS quickbooks_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_transfer_id TEXT NOT NULL,
  qb_sync_token TEXT,
  
  -- Transfer Details
  txn_date DATE,
  amount DECIMAL(15, 2) NOT NULL,
  
  -- From/To Accounts
  from_account_ref TEXT,
  from_account_name TEXT,
  to_account_ref TEXT,
  to_account_name TEXT,
  
  -- Memo
  private_note TEXT,
  
  -- Full QB data for reference
  full_data JSONB,
  
  -- Metadata
  qb_created_at TIMESTAMP WITH TIME ZONE,
  qb_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(connection_id, qb_transfer_id)
);

-- Indexes for transfers
CREATE INDEX IF NOT EXISTS idx_qb_transfers_connection ON quickbooks_transfers(connection_id);
CREATE INDEX IF NOT EXISTS idx_qb_transfers_txn_date ON quickbooks_transfers(txn_date);
CREATE INDEX IF NOT EXISTS idx_qb_transfers_from_account ON quickbooks_transfers(from_account_ref);
CREATE INDEX IF NOT EXISTS idx_qb_transfers_to_account ON quickbooks_transfers(to_account_ref);
CREATE INDEX IF NOT EXISTS idx_qb_transfers_updated ON quickbooks_transfers(qb_updated_at);

-- RLS for transfers
ALTER TABLE quickbooks_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view QB transfers"
  ON quickbooks_transfers FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- =============================================
-- 4. QuickBooks Classes Table (Departments/Projects)
-- =============================================
CREATE TABLE IF NOT EXISTS quickbooks_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_class_id TEXT NOT NULL,
  qb_sync_token TEXT,
  
  -- Class Details
  name TEXT NOT NULL,
  fully_qualified_name TEXT,
  
  -- Class Hierarchy
  parent_ref TEXT, -- Parent class ID
  sub_class BOOLEAN DEFAULT FALSE,
  class_level INTEGER, -- Depth in hierarchy
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Full QB data for reference
  full_data JSONB,
  
  -- Metadata
  qb_created_at TIMESTAMP WITH TIME ZONE,
  qb_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(connection_id, qb_class_id)
);

-- Indexes for classes
CREATE INDEX IF NOT EXISTS idx_qb_classes_connection ON quickbooks_classes(connection_id);
CREATE INDEX IF NOT EXISTS idx_qb_classes_parent ON quickbooks_classes(parent_ref);
CREATE INDEX IF NOT EXISTS idx_qb_classes_active ON quickbooks_classes(is_active);
CREATE INDEX IF NOT EXISTS idx_qb_classes_updated ON quickbooks_classes(qb_updated_at);
CREATE INDEX IF NOT EXISTS idx_qb_classes_name ON quickbooks_classes(name);

-- RLS for classes
ALTER TABLE quickbooks_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view QB classes"
  ON quickbooks_classes FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- =============================================
-- 5. QuickBooks Terms Table (Payment Terms)
-- =============================================
CREATE TABLE IF NOT EXISTS quickbooks_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_term_id TEXT NOT NULL,
  qb_sync_token TEXT,
  
  -- Term Details
  name TEXT NOT NULL,
  type TEXT, -- Standard, DateDriven
  
  -- Due Date Calculation
  due_days INTEGER,
  discount_days INTEGER,
  discount_percent DECIMAL(5, 2),
  day_of_month_due INTEGER,
  due_next_month_days INTEGER,
  discount_day_of_month INTEGER,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Full QB data for reference
  full_data JSONB,
  
  -- Metadata
  qb_created_at TIMESTAMP WITH TIME ZONE,
  qb_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(connection_id, qb_term_id)
);

-- Indexes for terms
CREATE INDEX IF NOT EXISTS idx_qb_terms_connection ON quickbooks_terms(connection_id);
CREATE INDEX IF NOT EXISTS idx_qb_terms_active ON quickbooks_terms(is_active);
CREATE INDEX IF NOT EXISTS idx_qb_terms_updated ON quickbooks_terms(qb_updated_at);
CREATE INDEX IF NOT EXISTS idx_qb_terms_name ON quickbooks_terms(name);

-- RLS for terms
ALTER TABLE quickbooks_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view QB terms"
  ON quickbooks_terms FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- =============================================
-- Comments
-- =============================================
COMMENT ON TABLE quickbooks_vendor_credits IS 'Credits from vendors (returns, adjustments) from QuickBooks';
COMMENT ON TABLE quickbooks_refund_receipts IS 'Customer refunds issued from QuickBooks';
COMMENT ON TABLE quickbooks_transfers IS 'Transfers between bank/credit card accounts from QuickBooks';
COMMENT ON TABLE quickbooks_classes IS 'Classes/Departments for tracking transactions by project or location';
COMMENT ON TABLE quickbooks_terms IS 'Payment terms (Net 30, Due on Receipt, etc.) from QuickBooks';

COMMENT ON COLUMN quickbooks_vendor_credits.remaining_credit IS 'Amount of credit still available to apply';
COMMENT ON COLUMN quickbooks_transfers.from_account_ref IS 'Account money is transferred FROM';
COMMENT ON COLUMN quickbooks_transfers.to_account_ref IS 'Account money is transferred TO';
COMMENT ON COLUMN quickbooks_classes.class_level IS 'Depth in class hierarchy (0 = top level)';
COMMENT ON COLUMN quickbooks_terms.type IS 'Standard (due in X days) or DateDriven (due on specific date)';

