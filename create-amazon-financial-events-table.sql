-- =====================================================
-- Amazon Financial Events Storage (Delta Sync)
-- =====================================================
-- This migration creates tables to store Amazon financial transaction data
-- for efficient delta sync and historical analysis.
--
-- Usage:
--   1. Run this SQL in Supabase SQL Editor
--   2. Initial sync will fetch last 179 days
--   3. Subsequent syncs only fetch new data since last sync
--   4. Sales Velocity calculations read from DB (fast!)
-- =====================================================

-- =====================================================
-- 1. Financial Sync Tracking Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.amazon_financial_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Sync metadata
  sync_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_completed_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed'
  
  -- Date range synced
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  days_synced INTEGER,
  
  -- Sync results
  events_fetched INTEGER DEFAULT 0,
  events_stored INTEGER DEFAULT 0,
  api_pages_fetched INTEGER DEFAULT 0,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  
  -- Performance metrics
  duration_seconds NUMERIC(10, 2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding last successful sync
CREATE INDEX IF NOT EXISTS idx_financial_syncs_status_completed 
  ON public.amazon_financial_syncs(sync_status, sync_completed_at DESC);

-- =====================================================
-- 2. Financial Events Storage Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.amazon_financial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to sync batch
  sync_id UUID REFERENCES public.amazon_financial_syncs(id) ON DELETE CASCADE,
  
  -- NOTE: Drizzle uses camelCase (syncId) but PostgreSQL uses snake_case (sync_id)
  -- The column name in DB is sync_id, Drizzle will map it automatically
  
  -- Transaction identification
  order_id TEXT,
  transaction_type TEXT NOT NULL, -- 'order', 'refund', 'adjustment', 'fee', 'ad_spend', etc.
  posted_date TIMESTAMPTZ,
  
  -- SKU information
  sku TEXT,
  asin TEXT,
  product_name TEXT,
  
  -- Financial amounts (all in USD)
  quantity INTEGER DEFAULT 0,
  principal_amount NUMERIC(12, 2) DEFAULT 0,
  tax_amount NUMERIC(12, 2) DEFAULT 0,
  shipping_amount NUMERIC(12, 2) DEFAULT 0,
  gift_wrap_amount NUMERIC(12, 2) DEFAULT 0,
  promotional_rebate NUMERIC(12, 2) DEFAULT 0,
  
  -- Fees
  commission_fee NUMERIC(12, 2) DEFAULT 0,
  fba_fee NUMERIC(12, 2) DEFAULT 0,
  referral_fee NUMERIC(12, 2) DEFAULT 0,
  other_fees NUMERIC(12, 2) DEFAULT 0,
  total_fees NUMERIC(12, 2) DEFAULT 0,
  
  -- Net amounts
  net_amount NUMERIC(12, 2) DEFAULT 0, -- After fees, before tax
  gross_amount NUMERIC(12, 2) DEFAULT 0, -- Before fees and tax
  
  -- Refund-specific fields
  refund_reason TEXT,
  is_reimbursement BOOLEAN DEFAULT FALSE,
  
  -- Ad spend fields
  campaign_name TEXT,
  ad_type TEXT,
  
  -- Adjustment fields
  adjustment_type TEXT,
  adjustment_reason TEXT,
  
  -- Raw event data (for debugging/future use)
  raw_event JSONB,
  
  -- Metadata
  marketplace_id TEXT DEFAULT 'ATVPDKIKX0DER', -- US marketplace
  currency_code TEXT DEFAULT 'USD',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_financial_events_sync_id 
  ON public.amazon_financial_events(sync_id);

CREATE INDEX IF NOT EXISTS idx_financial_events_posted_date 
  ON public.amazon_financial_events(posted_date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_events_sku 
  ON public.amazon_financial_events(sku);

CREATE INDEX IF NOT EXISTS idx_financial_events_order_id 
  ON public.amazon_financial_events(order_id);

CREATE INDEX IF NOT EXISTS idx_financial_events_transaction_type 
  ON public.amazon_financial_events(transaction_type);

CREATE INDEX IF NOT EXISTS idx_financial_events_sku_date 
  ON public.amazon_financial_events(sku, posted_date DESC);

-- =====================================================
-- 3. Helper Views
-- =====================================================

-- Latest sync info
CREATE OR REPLACE VIEW public.amazon_financial_latest_sync AS
SELECT 
  id,
  sync_status,
  period_start,
  period_end,
  days_synced,
  events_stored,
  sync_completed_at,
  duration_seconds
FROM public.amazon_financial_syncs
WHERE sync_status = 'completed'
ORDER BY sync_completed_at DESC
LIMIT 1;

-- SKU sales summary (for velocity calculations)
CREATE OR REPLACE VIEW public.amazon_financial_sku_summary AS
SELECT 
  sku,
  asin,
  product_name,
  COUNT(DISTINCT order_id) FILTER (WHERE transaction_type = 'order') as total_orders,
  SUM(quantity) FILTER (WHERE transaction_type = 'order') as total_units_sold,
  SUM(quantity) FILTER (WHERE transaction_type = 'refund') as total_units_refunded,
  SUM(net_amount) FILTER (WHERE transaction_type = 'order') as total_revenue,
  SUM(net_amount) FILTER (WHERE transaction_type = 'refund') as total_refunds,
  SUM(total_fees) FILTER (WHERE transaction_type = 'order') as total_fees,
  MIN(posted_date) as first_sale_date,
  MAX(posted_date) as last_sale_date,
  COUNT(*) as total_transactions
FROM public.amazon_financial_events
WHERE sku IS NOT NULL
GROUP BY sku, asin, product_name;

-- Daily sales velocity by SKU
CREATE OR REPLACE VIEW public.amazon_financial_daily_velocity AS
SELECT 
  sku,
  DATE(posted_date) as sale_date,
  SUM(quantity) FILTER (WHERE transaction_type = 'order') as units_sold,
  SUM(net_amount) FILTER (WHERE transaction_type = 'order') as revenue,
  SUM(total_fees) FILTER (WHERE transaction_type = 'order') as fees,
  COUNT(DISTINCT order_id) FILTER (WHERE transaction_type = 'order') as orders
FROM public.amazon_financial_events
WHERE sku IS NOT NULL AND posted_date IS NOT NULL
GROUP BY sku, DATE(posted_date)
ORDER BY sku, sale_date DESC;

-- =====================================================
-- 4. Row Level Security (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.amazon_financial_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amazon_financial_events ENABLE ROW LEVEL SECURITY;

-- Super Admin: Full access
CREATE POLICY "Super admins have full access to financial syncs"
  ON public.amazon_financial_syncs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins have full access to financial events"
  ON public.amazon_financial_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Admin/CFO: Read-only access
CREATE POLICY "Admins can view financial syncs"
  ON public.amazon_financial_syncs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'admin_cfo')
    )
  );

CREATE POLICY "Admins can view financial events"
  ON public.amazon_financial_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'admin_cfo')
    )
  );

-- =====================================================
-- 5. Comments
-- =====================================================

COMMENT ON TABLE public.amazon_financial_syncs IS 'Tracks Amazon financial data sync operations for delta sync';
COMMENT ON TABLE public.amazon_financial_events IS 'Stores raw Amazon financial transaction events for historical analysis';
COMMENT ON VIEW public.amazon_financial_latest_sync IS 'Shows the most recent successful financial data sync';
COMMENT ON VIEW public.amazon_financial_sku_summary IS 'Aggregated sales metrics by SKU for velocity calculations';
COMMENT ON VIEW public.amazon_financial_daily_velocity IS 'Daily sales velocity metrics by SKU';

-- =====================================================
-- 6. Success Message
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Amazon Financial Events tables created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Tables created:';
  RAISE NOTICE '   - amazon_financial_syncs (sync tracking)';
  RAISE NOTICE '   - amazon_financial_events (transaction storage)';
  RAISE NOTICE '';
  RAISE NOTICE '📈 Views created:';
  RAISE NOTICE '   - amazon_financial_latest_sync';
  RAISE NOTICE '   - amazon_financial_sku_summary';
  RAISE NOTICE '   - amazon_financial_daily_velocity';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 RLS policies enabled for super_admin and admin roles';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Next: Update /api/amazon/financial-data to use delta sync';
END $$;

