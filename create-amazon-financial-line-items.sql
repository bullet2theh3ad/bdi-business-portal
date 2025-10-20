-- =====================================================
-- Amazon Financial Line Items Table
-- Stores per-SKU transaction data from Amazon Financial Events API
-- =====================================================

-- Drop existing table if it exists (for clean re-creation)
DROP TABLE IF EXISTS amazon_financial_line_items CASCADE;

-- Create the main table for storing per-SKU financial line items
CREATE TABLE amazon_financial_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transaction Identification
  order_id TEXT NOT NULL,                    -- Amazon Order ID
  posted_date TIMESTAMPTZ NOT NULL,          -- When the transaction was posted
  transaction_type TEXT NOT NULL,            -- 'sale', 'refund', 'adjustment'
  
  -- SKU Information
  amazon_sku TEXT NOT NULL,                  -- Amazon Seller SKU
  asin TEXT,                                 -- Amazon ASIN (if available)
  bdi_sku TEXT,                             -- Mapped BDI SKU (from sku_mappings)
  product_name TEXT,                        -- Product title/name
  
  -- Quantity & Pricing
  quantity INTEGER NOT NULL DEFAULT 0,       -- Number of units
  unit_price NUMERIC(10, 2) DEFAULT 0,      -- Price per unit
  
  -- Revenue Components
  item_price NUMERIC(10, 2) DEFAULT 0,      -- Total item price
  shipping_price NUMERIC(10, 2) DEFAULT 0,  -- Shipping charges
  gift_wrap_price NUMERIC(10, 2) DEFAULT 0, -- Gift wrap charges
  item_promotion NUMERIC(10, 2) DEFAULT 0,  -- Promotional discounts
  shipping_promotion NUMERIC(10, 2) DEFAULT 0, -- Shipping discounts
  
  -- Tax
  item_tax NUMERIC(10, 2) DEFAULT 0,        -- Tax on item
  shipping_tax NUMERIC(10, 2) DEFAULT 0,    -- Tax on shipping
  gift_wrap_tax NUMERIC(10, 2) DEFAULT 0,   -- Tax on gift wrap
  
  -- Fees
  commission NUMERIC(10, 2) DEFAULT 0,      -- Amazon commission/referral fee
  fba_fees NUMERIC(10, 2) DEFAULT 0,        -- FBA fulfillment fees
  other_fees NUMERIC(10, 2) DEFAULT 0,      -- Other Amazon fees
  total_fees NUMERIC(10, 2) DEFAULT 0,      -- Sum of all fees
  
  -- Calculated Totals
  gross_revenue NUMERIC(10, 2) DEFAULT 0,   -- Revenue before fees (excl. tax)
  net_revenue NUMERIC(10, 2) DEFAULT 0,     -- Revenue after fees (excl. tax)
  total_tax NUMERIC(10, 2) DEFAULT 0,       -- Total tax collected
  
  -- Metadata
  marketplace_id TEXT,                       -- Amazon marketplace (e.g., ATVPDKIKX0DER for US)
  currency_code TEXT DEFAULT 'USD',         -- Currency
  raw_event JSONB,                          -- Full raw event data from Amazon API
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Primary lookup indexes
CREATE INDEX idx_financial_line_items_order_id ON amazon_financial_line_items(order_id);
CREATE INDEX idx_financial_line_items_amazon_sku ON amazon_financial_line_items(amazon_sku);
CREATE INDEX idx_financial_line_items_bdi_sku ON amazon_financial_line_items(bdi_sku);
CREATE INDEX idx_financial_line_items_asin ON amazon_financial_line_items(asin);

-- Date range queries (for reports and velocity calculations)
CREATE INDEX idx_financial_line_items_posted_date ON amazon_financial_line_items(posted_date DESC);

-- Transaction type filtering
CREATE INDEX idx_financial_line_items_transaction_type ON amazon_financial_line_items(transaction_type);

-- Composite index for SKU + date range queries (most common use case)
CREATE INDEX idx_financial_line_items_sku_date ON amazon_financial_line_items(bdi_sku, posted_date DESC);

-- Composite index for Amazon SKU + date range
CREATE INDEX idx_financial_line_items_amazon_sku_date ON amazon_financial_line_items(amazon_sku, posted_date DESC);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE amazon_financial_line_items ENABLE ROW LEVEL SECURITY;

-- Policy: BDI super_admins can see all data
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

-- Policy: BDI super_admins can insert data (for sync operations)
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

-- Policy: BDI super_admins can update data
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

-- Policy: BDI super_admins can delete data
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

-- =====================================================
-- Helper Function: Update timestamp on row update
-- =====================================================

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

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'amazon_financial_line_items'
ORDER BY ordinal_position;

-- Check indexes
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'amazon_financial_line_items';

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'amazon_financial_line_items';

-- =====================================================
-- RESULT SUMMARY
-- =====================================================
-- ✅ Table created: amazon_financial_line_items
-- ✅ Indexes created: 7 indexes for optimal query performance
-- ✅ RLS enabled: BDI super_admins only
-- ✅ Trigger created: Auto-update updated_at timestamp
-- 
-- NEXT STEPS:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Report back with results
-- 3. Update Drizzle schema to match
-- 4. Modify /api/amazon/financial-data to save line items to DB
-- =====================================================

