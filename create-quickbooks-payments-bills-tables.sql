-- QuickBooks Payments Table
-- Tracks when customers pay their invoices

CREATE TABLE IF NOT EXISTS quickbooks_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_payment_id TEXT NOT NULL,
  qb_sync_token TEXT,
  qb_customer_id TEXT,
  
  -- Payment Details
  customer_name TEXT,
  payment_date DATE NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL,
  unapplied_amount DECIMAL(15, 2) DEFAULT 0,
  
  -- Payment Method
  payment_method TEXT, -- Cash, Check, CreditCard, etc.
  reference_number TEXT, -- Check number, transaction ID
  
  -- Accounting
  deposit_to_account TEXT,
  
  -- Applied to invoices
  line_items JSONB, -- Array of {invoice_id, amount_applied}
  
  -- Metadata
  qb_created_at TIMESTAMPTZ,
  qb_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(connection_id, qb_payment_id)
);

-- QuickBooks Bills Table  
-- Tracks what you owe vendors (Accounts Payable)

CREATE TABLE IF NOT EXISTS quickbooks_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_bill_id TEXT NOT NULL,
  qb_sync_token TEXT,
  qb_vendor_id TEXT,
  
  -- Bill Details
  vendor_name TEXT,
  bill_number TEXT,
  bill_date DATE NOT NULL,
  due_date DATE,
  
  -- Amounts
  total_amount DECIMAL(15, 2) NOT NULL,
  balance DECIMAL(15, 2) NOT NULL,
  
  -- Status
  payment_status TEXT, -- Unpaid, Partial, Paid
  
  -- Line Items (what was purchased)
  line_items JSONB,
  
  -- Accounting
  ap_account_ref TEXT,
  
  -- Metadata
  qb_created_at TIMESTAMPTZ,
  qb_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(connection_id, qb_bill_id)
);

-- Indexes
CREATE INDEX idx_qb_payments_connection ON quickbooks_payments(connection_id);
CREATE INDEX idx_qb_payments_customer ON quickbooks_payments(qb_customer_id);
CREATE INDEX idx_qb_payments_date ON quickbooks_payments(payment_date);

CREATE INDEX idx_qb_bills_connection ON quickbooks_bills(connection_id);
CREATE INDEX idx_qb_bills_vendor ON quickbooks_bills(qb_vendor_id);
CREATE INDEX idx_qb_bills_date ON quickbooks_bills(bill_date);
CREATE INDEX idx_qb_bills_due_date ON quickbooks_bills(due_date);
CREATE INDEX idx_qb_bills_status ON quickbooks_bills(payment_status);

-- Enable RLS
ALTER TABLE quickbooks_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_bills ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "QuickBooks authorized users can view payments"
  ON quickbooks_payments FOR SELECT
  USING (auth.uid() IN (SELECT auth_id FROM quickbooks_authorized_users));

CREATE POLICY "QuickBooks authorized users can view bills"
  ON quickbooks_bills FOR SELECT
  USING (auth.uid() IN (SELECT auth_id FROM quickbooks_authorized_users));

-- Comments
COMMENT ON TABLE quickbooks_payments IS 'Customer payments received - cash flow tracking';
COMMENT ON TABLE quickbooks_bills IS 'Bills from vendors (Accounts Payable)';

