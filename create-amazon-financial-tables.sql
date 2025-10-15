-- =====================================================
-- Amazon Financial Events Database Schema
-- =====================================================
-- This schema stores transaction-level financial data from Amazon SP-API
-- Supports incremental syncs and historical data retention

-- Drop existing tables if they exist (for clean reinstall)
DROP TABLE IF EXISTS amazon_financial_event_items CASCADE;
DROP TABLE IF EXISTS amazon_financial_events CASCADE;
DROP TABLE IF EXISTS amazon_financial_sync_log CASCADE;

-- =====================================================
-- 1. Sync Log Table
-- =====================================================
-- Tracks when data was synced from Amazon and sync status
CREATE TABLE amazon_financial_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'auto', 'backfill'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  
  -- Date range for this sync
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Sync statistics
  events_fetched INTEGER DEFAULT 0,
  events_created INTEGER DEFAULT 0,
  events_updated INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  
  -- Performance metrics
  duration_seconds INTEGER,
  api_pages_fetched INTEGER DEFAULT 0,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  
  -- Metadata
  triggered_by UUID REFERENCES users(auth_id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Amazon API metadata
  intuit_tid TEXT, -- Amazon's transaction ID for support
  api_version TEXT DEFAULT '2024-06-19'
);

-- Index for finding latest syncs
CREATE INDEX idx_amazon_sync_log_dates ON amazon_financial_sync_log(start_date, end_date);
CREATE INDEX idx_amazon_sync_log_status ON amazon_financial_sync_log(status);
CREATE INDEX idx_amazon_sync_log_created ON amazon_financial_sync_log(created_at DESC);

-- =====================================================
-- 2. Financial Events Table
-- =====================================================
-- Stores top-level financial event groups (one per order typically)
CREATE TABLE amazon_financial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Amazon identifiers
  amazon_order_id TEXT NOT NULL UNIQUE, -- Amazon order ID (unique per order)
  seller_order_id TEXT, -- Merchant's order ID if different
  marketplace_name TEXT, -- e.g., "Amazon.com", "Amazon.ca"
  
  -- Dates
  posted_date TIMESTAMPTZ NOT NULL, -- When transaction was posted
  order_date TIMESTAMPTZ, -- When order was placed
  shipment_date TIMESTAMPTZ, -- When order was shipped
  
  -- Financial summary for this event
  total_amount NUMERIC(12, 2) DEFAULT 0,
  currency_code TEXT DEFAULT 'USD',
  
  -- Transaction type and status
  transaction_type TEXT, -- e.g., "Shipment", "Refund", "Adjustment"
  transaction_status TEXT, -- e.g., "Success", "Pending"
  
  -- Raw data from Amazon (for debugging and future-proofing)
  raw_event_data JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key to sync log
  sync_log_id UUID REFERENCES amazon_financial_sync_log(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX idx_amazon_events_order_id ON amazon_financial_events(amazon_order_id);
CREATE INDEX idx_amazon_events_posted_date ON amazon_financial_events(posted_date DESC);
CREATE INDEX idx_amazon_events_order_date ON amazon_financial_events(order_date DESC);
CREATE INDEX idx_amazon_events_marketplace ON amazon_financial_events(marketplace_name);
CREATE INDEX idx_amazon_events_transaction_type ON amazon_financial_events(transaction_type);
CREATE INDEX idx_amazon_events_sync_log ON amazon_financial_events(sync_log_id);

-- =====================================================
-- 3. Financial Event Items Table
-- =====================================================
-- Stores line-item details for each financial event (SKU-level)
CREATE TABLE amazon_financial_event_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign key to parent event
  event_id UUID NOT NULL REFERENCES amazon_financial_events(id) ON DELETE CASCADE,
  
  -- Product identifiers
  sku TEXT NOT NULL,
  asin TEXT,
  product_name TEXT,
  
  -- Quantity and pricing
  quantity INTEGER DEFAULT 1,
  item_price NUMERIC(12, 2) DEFAULT 0,
  item_tax NUMERIC(12, 2) DEFAULT 0,
  
  -- Fees breakdown
  commission_fee NUMERIC(12, 2) DEFAULT 0,
  fba_fee NUMERIC(12, 2) DEFAULT 0, -- Fulfillment by Amazon fee
  referral_fee NUMERIC(12, 2) DEFAULT 0,
  variable_closing_fee NUMERIC(12, 2) DEFAULT 0,
  shipping_charge NUMERIC(12, 2) DEFAULT 0,
  shipping_tax NUMERIC(12, 2) DEFAULT 0,
  gift_wrap_charge NUMERIC(12, 2) DEFAULT 0,
  gift_wrap_tax NUMERIC(12, 2) DEFAULT 0,
  promotion_discount NUMERIC(12, 2) DEFAULT 0,
  
  -- Calculated fields
  total_fees NUMERIC(12, 2) DEFAULT 0, -- Sum of all fees
  net_amount NUMERIC(12, 2) DEFAULT 0, -- Revenue minus fees
  
  -- Charge type (e.g., "Principal", "Tax", "ShippingCharge")
  charge_type TEXT,
  
  -- Raw data from Amazon (for debugging and future-proofing)
  raw_item_data JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_amazon_items_event_id ON amazon_financial_event_items(event_id);
CREATE INDEX idx_amazon_items_sku ON amazon_financial_event_items(sku);
CREATE INDEX idx_amazon_items_asin ON amazon_financial_event_items(asin);
CREATE INDEX idx_amazon_items_charge_type ON amazon_financial_event_items(charge_type);

-- Composite index for SKU performance queries
CREATE INDEX idx_amazon_items_sku_event ON amazon_financial_event_items(sku, event_id);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE amazon_financial_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE amazon_financial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE amazon_financial_event_items ENABLE ROW LEVEL SECURITY;

-- Policy: Only BDI admins can view financial data
CREATE POLICY amazon_sync_log_select_policy ON amazon_financial_sync_log
  FOR SELECT
  TO authenticated
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

CREATE POLICY amazon_events_select_policy ON amazon_financial_events
  FOR SELECT
  TO authenticated
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

CREATE POLICY amazon_items_select_policy ON amazon_financial_event_items
  FOR SELECT
  TO authenticated
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

-- Service role can do everything (for backend sync operations)
CREATE POLICY amazon_sync_log_service_policy ON amazon_financial_sync_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY amazon_events_service_policy ON amazon_financial_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY amazon_items_service_policy ON amazon_financial_event_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Helper Views
-- =====================================================

-- View: SKU Performance Summary
CREATE OR REPLACE VIEW amazon_sku_performance AS
SELECT 
  i.sku,
  i.asin,
  COUNT(DISTINCT e.amazon_order_id) as order_count,
  SUM(i.quantity) as total_units,
  SUM(i.item_price) as total_revenue,
  SUM(i.total_fees) as total_fees,
  SUM(i.net_amount) as total_net,
  AVG(i.item_price) as avg_price,
  MIN(e.posted_date) as first_sale_date,
  MAX(e.posted_date) as last_sale_date
FROM amazon_financial_event_items i
JOIN amazon_financial_events e ON i.event_id = e.id
GROUP BY i.sku, i.asin;

-- View: Daily Revenue Summary
CREATE OR REPLACE VIEW amazon_daily_revenue AS
SELECT 
  DATE(e.posted_date) as sale_date,
  COUNT(DISTINCT e.amazon_order_id) as order_count,
  SUM(i.quantity) as total_units,
  SUM(i.item_price) as total_revenue,
  SUM(i.total_fees) as total_fees,
  SUM(i.net_amount) as total_net,
  COUNT(DISTINCT i.sku) as unique_skus
FROM amazon_financial_events e
JOIN amazon_financial_event_items i ON e.id = i.event_id
GROUP BY DATE(e.posted_date)
ORDER BY sale_date DESC;

-- =====================================================
-- Useful Queries (Documentation)
-- =====================================================

-- Get latest sync status:
-- SELECT * FROM amazon_financial_sync_log ORDER BY created_at DESC LIMIT 1;

-- Get date range of stored data:
-- SELECT MIN(posted_date) as earliest, MAX(posted_date) as latest, COUNT(*) as total_events
-- FROM amazon_financial_events;

-- Get top SKUs by revenue:
-- SELECT * FROM amazon_sku_performance ORDER BY total_revenue DESC LIMIT 20;

-- Get revenue by month:
-- SELECT 
--   DATE_TRUNC('month', posted_date) as month,
--   COUNT(*) as orders,
--   SUM(total_amount) as revenue
-- FROM amazon_financial_events
-- GROUP BY month
-- ORDER BY month DESC;

-- Find missing date ranges (for backfill):
-- WITH date_range AS (
--   SELECT generate_series(
--     '2024-01-01'::date,
--     CURRENT_DATE,
--     '1 day'::interval
--   )::date as check_date
-- )
-- SELECT dr.check_date
-- FROM date_range dr
-- LEFT JOIN amazon_financial_events e ON DATE(e.posted_date) = dr.check_date
-- WHERE e.id IS NULL
-- ORDER BY dr.check_date;

COMMENT ON TABLE amazon_financial_sync_log IS 'Tracks synchronization history from Amazon SP-API Financial Events';
COMMENT ON TABLE amazon_financial_events IS 'Stores top-level financial event data (orders, refunds, adjustments)';
COMMENT ON TABLE amazon_financial_event_items IS 'Stores line-item details for each financial event (SKU-level data)';

