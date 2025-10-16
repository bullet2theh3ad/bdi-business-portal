-- =====================================================
-- QuickBooks Deposits & BillPayments Tables
-- =====================================================
-- Purpose: Complete cash flow tracking by capturing:
-- 1. Deposits - Income hitting bank accounts (non-invoice sources)
-- 2. BillPayments - Actual vendor payments (when bills are paid)
-- =====================================================

-- =============================================================================
-- Table: quickbooks_deposits
-- =============================================================================
-- Captures income deposits to bank accounts (cash, checks, transfers, etc.)
-- These are often from non-invoice sources like interest, refunds, misc income

CREATE TABLE IF NOT EXISTS quickbooks_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_deposit_id TEXT NOT NULL,
  qb_sync_token TEXT,
  
  -- Deposit Details
  txn_date DATE NOT NULL,
  doc_number TEXT, -- Reference number
  total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  
  -- Deposit To Account (which bank account)
  deposit_to_account_ref TEXT,
  deposit_to_account_name TEXT,
  deposit_to_account_value TEXT,
  
  -- Currency
  currency_code TEXT DEFAULT 'USD',
  exchange_rate DECIMAL(15, 6),
  
  -- Line Items (multiple sources can be in one deposit)
  -- Format: [{amount, description, account_ref, account_name, entity_ref, entity_name}]
  line_items JSONB DEFAULT '[]'::jsonb,
  
  -- Line count for quick stats
  line_count INTEGER DEFAULT 0,
  
  -- Memo/Notes
  private_note TEXT,
  customer_memo TEXT,
  
  -- Metadata from QuickBooks
  qb_created_at TIMESTAMPTZ,
  qb_updated_at TIMESTAMPTZ,
  
  -- Local tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure uniqueness per connection
  CONSTRAINT unique_qb_deposit UNIQUE(connection_id, qb_deposit_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_qb_deposits_connection 
  ON quickbooks_deposits(connection_id);
  
CREATE INDEX IF NOT EXISTS idx_qb_deposits_txn_date 
  ON quickbooks_deposits(txn_date DESC);
  
CREATE INDEX IF NOT EXISTS idx_qb_deposits_amount 
  ON quickbooks_deposits(total_amount);
  
CREATE INDEX IF NOT EXISTS idx_qb_deposits_account 
  ON quickbooks_deposits(deposit_to_account_ref);

-- GIN index for searching within line items
CREATE INDEX IF NOT EXISTS idx_qb_deposits_line_items 
  ON quickbooks_deposits USING GIN (line_items);

-- =============================================================================
-- Table: quickbooks_bill_payments
-- =============================================================================
-- Captures actual payments made to vendors for bills
-- Critical for cash flow tracking and AP reconciliation

CREATE TABLE IF NOT EXISTS quickbooks_bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_payment_id TEXT NOT NULL,
  qb_sync_token TEXT,
  
  -- Payment Details
  txn_date DATE NOT NULL,
  doc_number TEXT, -- Check number or reference
  total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  
  -- Vendor Information
  vendor_ref TEXT,
  vendor_name TEXT,
  vendor_value TEXT,
  
  -- Payment Method
  payment_type TEXT, -- Check, CreditCard, Cash, etc.
  payment_method_ref TEXT,
  payment_method_name TEXT,
  
  -- Payment Account (which bank/credit card account)
  payment_account_ref TEXT,
  payment_account_name TEXT,
  payment_account_value TEXT,
  
  -- Check Information
  check_num TEXT,
  print_status TEXT, -- NeedToPrint, PrintComplete, etc.
  
  -- Currency
  currency_code TEXT DEFAULT 'USD',
  exchange_rate DECIMAL(15, 6),
  
  -- Bills Paid (can pay multiple bills in one transaction)
  -- Format: [{bill_id, bill_ref_value, amount_paid, linked_txn}]
  line_items JSONB DEFAULT '[]'::jsonb,
  
  -- Line count for quick stats
  line_count INTEGER DEFAULT 0,
  
  -- Memo/Notes
  private_note TEXT,
  
  -- Credit Card Transaction (if applicable)
  credit_card_txn_info JSONB, -- {txn_authorization_time, txn_id, etc.}
  
  -- Metadata from QuickBooks
  qb_created_at TIMESTAMPTZ,
  qb_updated_at TIMESTAMPTZ,
  
  -- Local tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure uniqueness per connection
  CONSTRAINT unique_qb_bill_payment UNIQUE(connection_id, qb_payment_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_qb_bill_payments_connection 
  ON quickbooks_bill_payments(connection_id);
  
CREATE INDEX IF NOT EXISTS idx_qb_bill_payments_txn_date 
  ON quickbooks_bill_payments(txn_date DESC);
  
CREATE INDEX IF NOT EXISTS idx_qb_bill_payments_vendor 
  ON quickbooks_bill_payments(vendor_ref);
  
CREATE INDEX IF NOT EXISTS idx_qb_bill_payments_amount 
  ON quickbooks_bill_payments(total_amount);
  
CREATE INDEX IF NOT EXISTS idx_qb_bill_payments_account 
  ON quickbooks_bill_payments(payment_account_ref);
  
CREATE INDEX IF NOT EXISTS idx_qb_bill_payments_check_num 
  ON quickbooks_bill_payments(check_num);

-- GIN index for searching within line items
CREATE INDEX IF NOT EXISTS idx_qb_bill_payments_line_items 
  ON quickbooks_bill_payments USING GIN (line_items);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE quickbooks_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_bill_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Only BDI admins can access QuickBooks data
CREATE POLICY "BDI admins can view deposits"
  ON quickbooks_deposits
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN organization_members om ON u.auth_id = om.user_auth_id
      JOIN organizations o ON om.organization_uuid = o.id
      WHERE u.auth_id = auth.uid()
        AND o.code = 'BDI'
        AND u.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "BDI admins can view bill payments"
  ON quickbooks_bill_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN organization_members om ON u.auth_id = om.user_auth_id
      JOIN organizations o ON om.organization_uuid = o.id
      WHERE u.auth_id = auth.uid()
        AND o.code = 'BDI'
        AND u.role IN ('super_admin', 'admin')
    )
  );

-- =============================================================================
-- Triggers for updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_quickbooks_deposits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_quickbooks_deposits_updated_at
  BEFORE UPDATE ON quickbooks_deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_quickbooks_deposits_updated_at();

CREATE OR REPLACE FUNCTION update_quickbooks_bill_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_quickbooks_bill_payments_updated_at
  BEFORE UPDATE ON quickbooks_bill_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_quickbooks_bill_payments_updated_at();

-- =============================================================================
-- Helper Views
-- =============================================================================

-- View: Recent Deposits Summary
CREATE OR REPLACE VIEW quickbooks_deposits_summary AS
SELECT 
  d.id,
  d.txn_date,
  d.doc_number,
  d.total_amount,
  d.deposit_to_account_name,
  d.line_count,
  d.private_note,
  d.created_at,
  c.company_name,
  c.realm_id
FROM quickbooks_deposits d
LEFT JOIN quickbooks_connections c ON d.connection_id = c.id
WHERE c.is_active = TRUE
ORDER BY d.txn_date DESC;

-- View: Recent BillPayments Summary
CREATE OR REPLACE VIEW quickbooks_bill_payments_summary AS
SELECT 
  bp.id,
  bp.txn_date,
  bp.doc_number,
  bp.check_num,
  bp.vendor_name,
  bp.total_amount,
  bp.payment_type,
  bp.payment_account_name,
  bp.line_count,
  bp.created_at,
  c.company_name,
  c.realm_id
FROM quickbooks_bill_payments bp
LEFT JOIN quickbooks_connections c ON bp.connection_id = c.id
WHERE c.is_active = TRUE
ORDER BY bp.txn_date DESC;

-- =============================================================================
-- Sample Queries
-- =============================================================================

-- Get deposits for a specific month
-- SELECT * FROM quickbooks_deposits
-- WHERE txn_date >= '2025-01-01' AND txn_date < '2025-02-01'
-- ORDER BY txn_date DESC;

-- Get all bill payments for a vendor
-- SELECT * FROM quickbooks_bill_payments
-- WHERE vendor_name ILIKE '%Vendor Name%'
-- ORDER BY txn_date DESC;

-- Get total deposits by account
-- SELECT 
--   deposit_to_account_name,
--   COUNT(*) as deposit_count,
--   SUM(total_amount) as total_amount
-- FROM quickbooks_deposits
-- GROUP BY deposit_to_account_name
-- ORDER BY total_amount DESC;

-- Get total bill payments by vendor
-- SELECT 
--   vendor_name,
--   COUNT(*) as payment_count,
--   SUM(total_amount) as total_paid
-- FROM quickbooks_bill_payments
-- GROUP BY vendor_name
-- ORDER BY total_paid DESC;

-- =============================================================================
-- Verification Queries
-- =============================================================================

-- Check table structure
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name IN ('quickbooks_deposits', 'quickbooks_bill_payments')
-- ORDER BY table_name, ordinal_position;

-- Check indexes
-- SELECT tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('quickbooks_deposits', 'quickbooks_bill_payments');

-- =============================================================================
-- Notes
-- =============================================================================

/*
DEPOSITS vs SALES RECEIPTS vs PAYMENTS:
- Sales Receipt: Cash sale at time of service/product delivery
- Payment: Customer payment against an existing invoice
- Deposit: Money going INTO bank account (can include payments, sales receipts, other income)

BILL PAYMENTS vs BILLS:
- Bill: Vendor invoice (what you owe)
- BillPayment: Actual payment made to vendor (when you pay)

These tables complete the cash flow picture:
1. Invoices (what customers owe) + Payments (what they paid) + Deposits (what hit bank)
2. Bills (what you owe) + BillPayments (what you paid) + Expenses (what you spent)

With these, you can track:
- Accounts Receivable timing (invoice → payment → deposit)
- Accounts Payable timing (bill → payment)
- Cash basis accounting (when money actually moves)
- Bank reconciliation (deposits match payments)
*/

