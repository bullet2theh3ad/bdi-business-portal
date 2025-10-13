-- QuickBooks Additional Entities
-- Sales Receipts, Credit Memos, Purchase Orders
-- Run this in Supabase SQL Editor

-- =============================================
-- SALES RECEIPTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS quickbooks_sales_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_sales_receipt_id TEXT NOT NULL,
  qb_sync_token TEXT,
  
  -- Customer Info
  customer_ref TEXT,
  customer_name TEXT,
  
  -- Transaction Details
  doc_number TEXT,
  txn_date DATE,
  
  -- Amounts
  total_amount DECIMAL(15, 2),
  balance DECIMAL(15, 2),
  
  -- Payment Info
  payment_method_ref TEXT,
  payment_method_name TEXT,
  deposit_to_account_ref TEXT,
  
  -- Status
  email_status TEXT,
  print_status TEXT,
  
  -- Metadata
  memo TEXT,
  full_data JSONB,
  qb_created_at TIMESTAMPTZ,
  qb_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(connection_id, qb_sales_receipt_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qb_sales_receipts_connection ON quickbooks_sales_receipts(connection_id);
CREATE INDEX IF NOT EXISTS idx_qb_sales_receipts_customer ON quickbooks_sales_receipts(customer_name);
CREATE INDEX IF NOT EXISTS idx_qb_sales_receipts_date ON quickbooks_sales_receipts(txn_date);
CREATE INDEX IF NOT EXISTS idx_qb_sales_receipts_doc_number ON quickbooks_sales_receipts(doc_number);

-- Enable RLS
ALTER TABLE quickbooks_sales_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "QuickBooks authorized users can view sales receipts" ON quickbooks_sales_receipts;
CREATE POLICY "QuickBooks authorized users can view sales receipts"
  ON quickbooks_sales_receipts FOR SELECT
  USING (auth.uid() IN (SELECT auth_id FROM quickbooks_authorized_users));

DROP POLICY IF EXISTS "Service role can insert sales receipts" ON quickbooks_sales_receipts;
CREATE POLICY "Service role can insert sales receipts"
  ON quickbooks_sales_receipts FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update sales receipts" ON quickbooks_sales_receipts;
CREATE POLICY "Service role can update sales receipts"
  ON quickbooks_sales_receipts FOR UPDATE
  USING (true) WITH CHECK (true);

-- =============================================
-- CREDIT MEMOS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS quickbooks_credit_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_credit_memo_id TEXT NOT NULL,
  qb_sync_token TEXT,
  
  -- Customer Info
  customer_ref TEXT,
  customer_name TEXT,
  
  -- Transaction Details
  doc_number TEXT,
  txn_date DATE,
  
  -- Amounts
  total_amount DECIMAL(15, 2),
  balance DECIMAL(15, 2),
  remaining_credit DECIMAL(15, 2),
  
  -- Status
  email_status TEXT,
  print_status TEXT,
  apply_tax_after_discount BOOLEAN,
  
  -- Metadata
  memo TEXT,
  private_note TEXT,
  full_data JSONB,
  qb_created_at TIMESTAMPTZ,
  qb_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(connection_id, qb_credit_memo_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qb_credit_memos_connection ON quickbooks_credit_memos(connection_id);
CREATE INDEX IF NOT EXISTS idx_qb_credit_memos_customer ON quickbooks_credit_memos(customer_name);
CREATE INDEX IF NOT EXISTS idx_qb_credit_memos_date ON quickbooks_credit_memos(txn_date);
CREATE INDEX IF NOT EXISTS idx_qb_credit_memos_doc_number ON quickbooks_credit_memos(doc_number);

-- Enable RLS
ALTER TABLE quickbooks_credit_memos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "QuickBooks authorized users can view credit memos" ON quickbooks_credit_memos;
CREATE POLICY "QuickBooks authorized users can view credit memos"
  ON quickbooks_credit_memos FOR SELECT
  USING (auth.uid() IN (SELECT auth_id FROM quickbooks_authorized_users));

DROP POLICY IF EXISTS "Service role can insert credit memos" ON quickbooks_credit_memos;
CREATE POLICY "Service role can insert credit memos"
  ON quickbooks_credit_memos FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update credit memos" ON quickbooks_credit_memos;
CREATE POLICY "Service role can update credit memos"
  ON quickbooks_credit_memos FOR UPDATE
  USING (true) WITH CHECK (true);

-- =============================================
-- PURCHASE ORDERS TABLE (QuickBooks)
-- Note: Named "quickbooks_purchase_orders_qb" to avoid conflict with CPFR POs
-- =============================================
CREATE TABLE IF NOT EXISTS quickbooks_purchase_orders_qb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_po_id TEXT NOT NULL,
  qb_sync_token TEXT,
  
  -- Vendor Info
  vendor_ref TEXT,
  vendor_name TEXT,
  
  -- Transaction Details
  doc_number TEXT,
  txn_date DATE,
  
  -- Amounts
  total_amount DECIMAL(15, 2),
  
  -- Shipping
  ship_method_ref TEXT,
  ship_method_name TEXT,
  ship_date DATE,
  tracking_num TEXT,
  
  -- Status
  email_status TEXT,
  print_status TEXT,
  po_status TEXT, -- Open, Closed
  
  -- Metadata
  memo TEXT,
  private_note TEXT,
  full_data JSONB,
  qb_created_at TIMESTAMPTZ,
  qb_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(connection_id, qb_po_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qb_pos_connection ON quickbooks_purchase_orders_qb(connection_id);
CREATE INDEX IF NOT EXISTS idx_qb_pos_vendor ON quickbooks_purchase_orders_qb(vendor_name);
CREATE INDEX IF NOT EXISTS idx_qb_pos_date ON quickbooks_purchase_orders_qb(txn_date);
CREATE INDEX IF NOT EXISTS idx_qb_pos_doc_number ON quickbooks_purchase_orders_qb(doc_number);
CREATE INDEX IF NOT EXISTS idx_qb_pos_status ON quickbooks_purchase_orders_qb(po_status);

-- Enable RLS
ALTER TABLE quickbooks_purchase_orders_qb ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "QuickBooks authorized users can view purchase orders" ON quickbooks_purchase_orders_qb;
CREATE POLICY "QuickBooks authorized users can view purchase orders"
  ON quickbooks_purchase_orders_qb FOR SELECT
  USING (auth.uid() IN (SELECT auth_id FROM quickbooks_authorized_users));

DROP POLICY IF EXISTS "Service role can insert purchase orders" ON quickbooks_purchase_orders_qb;
CREATE POLICY "Service role can insert purchase orders"
  ON quickbooks_purchase_orders_qb FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update purchase orders" ON quickbooks_purchase_orders_qb;
CREATE POLICY "Service role can update purchase orders"
  ON quickbooks_purchase_orders_qb FOR UPDATE
  USING (true) WITH CHECK (true);

-- Comments
COMMENT ON TABLE quickbooks_sales_receipts IS 'QuickBooks sales receipts - cash sales transactions';
COMMENT ON TABLE quickbooks_credit_memos IS 'QuickBooks credit memos - customer credits/refunds';
COMMENT ON TABLE quickbooks_purchase_orders_qb IS 'QuickBooks purchase orders to vendors (distinct from CPFR POs)';

