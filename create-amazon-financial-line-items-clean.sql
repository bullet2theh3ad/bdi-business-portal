-- =====================================================
-- Amazon Financial Line Items Table (CLEAN VERSION)
-- Stores per-SKU transaction data from Amazon Financial Events API
-- =====================================================

-- Drop existing table if it exists (for clean re-creation)
DROP TABLE IF EXISTS amazon_financial_line_items CASCADE;

-- Create the main table for storing per-SKU financial line items
CREATE TABLE amazon_financial_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transaction Identification
  order_id TEXT NOT NULL,
  posted_date TIMESTAMPTZ NOT NULL,
  transaction_type TEXT NOT NULL,
  
  -- SKU Information
  amazon_sku TEXT NOT NULL,
  asin TEXT,
  bdi_sku TEXT,
  product_name TEXT,
  
  -- Quantity & Pricing
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(10, 2) DEFAULT 0,
  
  -- Revenue Components
  item_price NUMERIC(10, 2) DEFAULT 0,
  shipping_price NUMERIC(10, 2) DEFAULT 0,
  gift_wrap_price NUMERIC(10, 2) DEFAULT 0,
  item_promotion NUMERIC(10, 2) DEFAULT 0,
  shipping_promotion NUMERIC(10, 2) DEFAULT 0,
  
  -- Tax
  item_tax NUMERIC(10, 2) DEFAULT 0,
  shipping_tax NUMERIC(10, 2) DEFAULT 0,
  gift_wrap_tax NUMERIC(10, 2) DEFAULT 0,
  
  -- Fees
  commission NUMERIC(10, 2) DEFAULT 0,
  fba_fees NUMERIC(10, 2) DEFAULT 0,
  other_fees NUMERIC(10, 2) DEFAULT 0,
  total_fees NUMERIC(10, 2) DEFAULT 0,
  
  -- Calculated Totals
  gross_revenue NUMERIC(10, 2) DEFAULT 0,
  net_revenue NUMERIC(10, 2) DEFAULT 0,
  total_tax NUMERIC(10, 2) DEFAULT 0,
  
  -- Metadata
  marketplace_id TEXT,
  currency_code TEXT DEFAULT 'USD',
  raw_event JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_financial_line_items_order_id ON amazon_financial_line_items(order_id);
CREATE INDEX idx_financial_line_items_amazon_sku ON amazon_financial_line_items(amazon_sku);
CREATE INDEX idx_financial_line_items_bdi_sku ON amazon_financial_line_items(bdi_sku);
CREATE INDEX idx_financial_line_items_asin ON amazon_financial_line_items(asin);
CREATE INDEX idx_financial_line_items_posted_date ON amazon_financial_line_items(posted_date DESC);
CREATE INDEX idx_financial_line_items_transaction_type ON amazon_financial_line_items(transaction_type);
CREATE INDEX idx_financial_line_items_sku_date ON amazon_financial_line_items(bdi_sku, posted_date DESC);
CREATE INDEX idx_financial_line_items_amazon_sku_date ON amazon_financial_line_items(amazon_sku, posted_date DESC);

-- Enable RLS
ALTER TABLE amazon_financial_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "BDI super_admins can view all financial line items"
  ON amazon_financial_line_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
      INNER JOIN organizations o ON om.organization_uuid = o.id
      WHERE u.auth_id = auth.uid()
        AND u.role = 'super_admin'
        AND o.code = 'BDI'
    )
  );

CREATE POLICY "BDI super_admins can insert financial line items"
  ON amazon_financial_line_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
      INNER JOIN organizations o ON om.organization_uuid = o.id
      WHERE u.auth_id = auth.uid()
        AND u.role = 'super_admin'
        AND o.code = 'BDI'
    )
  );

CREATE POLICY "BDI super_admins can update financial line items"
  ON amazon_financial_line_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
      INNER JOIN organizations o ON om.organization_uuid = o.id
      WHERE u.auth_id = auth.uid()
        AND u.role = 'super_admin'
        AND o.code = 'BDI'
    )
  );

CREATE POLICY "BDI super_admins can delete financial line items"
  ON amazon_financial_line_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
      INNER JOIN organizations o ON om.organization_uuid = o.id
      WHERE u.auth_id = auth.uid()
        AND u.role = 'super_admin'
        AND o.code = 'BDI'
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_amazon_financial_line_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_amazon_financial_line_items_updated_at
  BEFORE UPDATE ON amazon_financial_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_amazon_financial_line_items_updated_at();

-- Verification
SELECT 'Table created successfully' AS status;

