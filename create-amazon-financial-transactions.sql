-- =====================================================
-- Amazon Financial Transactions (SKU-Level Delta Sync)
-- =====================================================
-- This creates a NEW table for SKU-level financial data
-- separate from the existing amazon_financial_events table.
--
-- Purpose: Store detailed SKU-level sales data for velocity calculations
-- Strategy: Delta sync - only fetch new data since last sync (179-day increments)
-- =====================================================

-- =====================================================
-- 1. Financial Transaction Sync Tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS public.amazon_financial_transaction_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Sync metadata
  sync_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_completed_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed'
  sync_type TEXT DEFAULT 'full', -- 'full', 'delta'
  
  -- Date range synced
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  days_synced INTEGER,
  
  -- Sync results
  transactions_fetched INTEGER DEFAULT 0,
  transactions_stored INTEGER DEFAULT 0,
  skus_processed INTEGER DEFAULT 0,
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
CREATE INDEX IF NOT EXISTS idx_financial_transaction_syncs_status_completed 
  ON public.amazon_financial_transaction_syncs(sync_status, sync_completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_transaction_syncs_period 
  ON public.amazon_financial_transaction_syncs(period_start, period_end);

-- =====================================================
-- 2. SKU-Level Financial Transactions Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.amazon_financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to sync batch
  sync_id UUID REFERENCES public.amazon_financial_transaction_syncs(id) ON DELETE CASCADE,
  
  -- Transaction identification
  order_id TEXT,
  posted_date TIMESTAMPTZ,
  transaction_type TEXT NOT NULL, -- 'sale', 'refund', 'fee', 'adjustment'
  
  -- SKU information
  sku TEXT NOT NULL,
  asin TEXT,
  product_name TEXT,
  
  -- Quantity
  quantity INTEGER DEFAULT 0, -- Positive for sales, negative for refunds
  
  -- Revenue breakdown (per-unit basis)
  unit_price NUMERIC(10, 2) DEFAULT 0,
  item_price NUMERIC(12, 2) DEFAULT 0, -- Total item price (quantity * unit_price)
  shipping_price NUMERIC(10, 2) DEFAULT 0,
  gift_wrap_price NUMERIC(10, 2) DEFAULT 0,
  item_tax NUMERIC(10, 2) DEFAULT 0,
  shipping_tax NUMERIC(10, 2) DEFAULT 0,
  gift_wrap_tax NUMERIC(10, 2) DEFAULT 0,
  
  -- Promotional discounts
  item_promotion NUMERIC(10, 2) DEFAULT 0,
  shipping_promotion NUMERIC(10, 2) DEFAULT 0,
  
  -- Fees (Amazon's cut)
  commission NUMERIC(10, 2) DEFAULT 0,
  fba_fees NUMERIC(10, 2) DEFAULT 0,
  referral_fee NUMERIC(10, 2) DEFAULT 0,
  variable_closing_fee NUMERIC(10, 2) DEFAULT 0,
  other_transaction_fees NUMERIC(10, 2) DEFAULT 0,
  total_fees NUMERIC(10, 2) DEFAULT 0,
  
  -- Calculated amounts
  gross_revenue NUMERIC(12, 2) DEFAULT 0, -- Before fees, before tax
  net_revenue NUMERIC(12, 2) DEFAULT 0, -- After fees, before tax
  total_tax NUMERIC(12, 2) DEFAULT 0, -- Sum of all taxes
  
  -- Refund-specific
  refund_reason TEXT,
  is_reimbursement BOOLEAN DEFAULT FALSE,
  
  -- Ad spend (if applicable to this transaction)
  ad_spend NUMERIC(10, 2) DEFAULT 0,
  campaign_name TEXT,
  
  -- Metadata
  marketplace_id TEXT DEFAULT 'ATVPDKIKX0DER', -- US marketplace
  currency_code TEXT DEFAULT 'USD',
  
  -- Raw data for debugging
  raw_event JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_financial_transactions_sync_id 
  ON public.amazon_financial_transactions(sync_id);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_posted_date 
  ON public.amazon_financial_transactions(posted_date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_sku 
  ON public.amazon_financial_transactions(sku);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_sku_date 
  ON public.amazon_financial_transactions(sku, posted_date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_order_id 
  ON public.amazon_financial_transactions(order_id);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_type 
  ON public.amazon_financial_transactions(transaction_type);

-- Composite index for velocity calculations
CREATE INDEX IF NOT EXISTS idx_financial_transactions_sku_type_date 
  ON public.amazon_financial_transactions(sku, transaction_type, posted_date DESC);

-- =====================================================
-- 3. Helper Views for Sales Velocity
-- =====================================================

-- Latest sync info
CREATE OR REPLACE VIEW public.amazon_financial_transactions_latest_sync AS
SELECT 
  id,
  sync_status,
  sync_type,
  period_start,
  period_end,
  days_synced,
  transactions_stored,
  skus_processed,
  sync_completed_at,
  duration_seconds
FROM public.amazon_financial_transaction_syncs
WHERE sync_status = 'completed'
ORDER BY sync_completed_at DESC
LIMIT 1;

-- SKU sales summary (optimized for velocity calculations)
CREATE OR REPLACE VIEW public.amazon_financial_sku_sales_summary AS
SELECT 
  sku,
  asin,
  product_name,
  
  -- Sales metrics
  COUNT(DISTINCT order_id) FILTER (WHERE transaction_type = 'sale' AND quantity > 0) as total_orders,
  SUM(quantity) FILTER (WHERE transaction_type = 'sale') as total_units_sold,
  SUM(ABS(quantity)) FILTER (WHERE transaction_type = 'refund') as total_units_refunded,
  SUM(net_revenue) FILTER (WHERE transaction_type = 'sale') as total_net_revenue,
  SUM(ABS(net_revenue)) FILTER (WHERE transaction_type = 'refund') as total_refunds,
  SUM(total_fees) FILTER (WHERE transaction_type = 'sale') as total_fees_paid,
  SUM(ad_spend) as total_ad_spend,
  
  -- Date range
  MIN(posted_date) as first_sale_date,
  MAX(posted_date) as last_sale_date,
  
  -- Average metrics
  AVG(unit_price) FILTER (WHERE transaction_type = 'sale' AND quantity > 0) as avg_unit_price,
  
  -- Transaction count
  COUNT(*) as total_transactions
  
FROM public.amazon_financial_transactions
WHERE sku IS NOT NULL
GROUP BY sku, asin, product_name;

-- Daily sales velocity by SKU (for trending)
CREATE OR REPLACE VIEW public.amazon_financial_daily_sales AS
SELECT 
  sku,
  DATE(posted_date) as sale_date,
  SUM(quantity) FILTER (WHERE transaction_type = 'sale') as units_sold,
  SUM(net_revenue) FILTER (WHERE transaction_type = 'sale') as net_revenue,
  SUM(total_fees) FILTER (WHERE transaction_type = 'sale') as fees_paid,
  SUM(ad_spend) as ad_spend,
  COUNT(DISTINCT order_id) FILTER (WHERE transaction_type = 'sale') as orders
FROM public.amazon_financial_transactions
WHERE sku IS NOT NULL AND posted_date IS NOT NULL
GROUP BY sku, DATE(posted_date)
ORDER BY sku, sale_date DESC;

-- Last 30 days velocity (for quick lookups)
CREATE OR REPLACE VIEW public.amazon_financial_velocity_30d AS
SELECT 
  sku,
  SUM(quantity) FILTER (WHERE transaction_type = 'sale') as units_sold_30d,
  SUM(net_revenue) FILTER (WHERE transaction_type = 'sale') as revenue_30d,
  COUNT(DISTINCT order_id) FILTER (WHERE transaction_type = 'sale') as orders_30d,
  SUM(quantity) FILTER (WHERE transaction_type = 'sale')::NUMERIC / 30 as daily_velocity_30d
FROM public.amazon_financial_transactions
WHERE sku IS NOT NULL 
  AND posted_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY sku;

-- Last 7 days velocity (for quick lookups)
CREATE OR REPLACE VIEW public.amazon_financial_velocity_7d AS
SELECT 
  sku,
  SUM(quantity) FILTER (WHERE transaction_type = 'sale') as units_sold_7d,
  SUM(net_revenue) FILTER (WHERE transaction_type = 'sale') as revenue_7d,
  COUNT(DISTINCT order_id) FILTER (WHERE transaction_type = 'sale') as orders_7d,
  SUM(quantity) FILTER (WHERE transaction_type = 'sale')::NUMERIC / 7 as daily_velocity_7d
FROM public.amazon_financial_transactions
WHERE sku IS NOT NULL 
  AND posted_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY sku;

-- =====================================================
-- 4. Row Level Security (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.amazon_financial_transaction_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amazon_financial_transactions ENABLE ROW LEVEL SECURITY;

-- Super Admin: Full access
CREATE POLICY "Super admins have full access to transaction syncs"
  ON public.amazon_financial_transaction_syncs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins have full access to transactions"
  ON public.amazon_financial_transactions
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
CREATE POLICY "Admins can view transaction syncs"
  ON public.amazon_financial_transaction_syncs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'admin_cfo')
    )
  );

CREATE POLICY "Admins can view transactions"
  ON public.amazon_financial_transactions
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
-- 5. Helper Function: Get Last Sync Date
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_last_financial_transaction_sync_date()
RETURNS DATE AS $$
BEGIN
  RETURN (
    SELECT period_end
    FROM public.amazon_financial_transaction_syncs
    WHERE sync_status = 'completed'
    ORDER BY sync_completed_at DESC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. Comments
-- =====================================================

COMMENT ON TABLE public.amazon_financial_transaction_syncs IS 'Tracks SKU-level financial data sync operations for delta sync (179-day increments)';
COMMENT ON TABLE public.amazon_financial_transactions IS 'Stores SKU-level Amazon financial transaction data for sales velocity calculations';
COMMENT ON VIEW public.amazon_financial_transactions_latest_sync IS 'Shows the most recent successful transaction sync';
COMMENT ON VIEW public.amazon_financial_sku_sales_summary IS 'Aggregated sales metrics by SKU for velocity calculations';
COMMENT ON VIEW public.amazon_financial_daily_sales IS 'Daily sales velocity metrics by SKU for trending analysis';
COMMENT ON VIEW public.amazon_financial_velocity_30d IS 'Last 30 days velocity metrics by SKU';
COMMENT ON VIEW public.amazon_financial_velocity_7d IS 'Last 7 days velocity metrics by SKU';
COMMENT ON FUNCTION public.get_last_financial_transaction_sync_date IS 'Returns the end date of the last successful sync for delta sync logic';

-- =====================================================
-- 7. Success Message
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Amazon Financial Transactions tables created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Tables created:';
  RAISE NOTICE '   - amazon_financial_transaction_syncs (sync tracking)';
  RAISE NOTICE '   - amazon_financial_transactions (SKU-level data)';
  RAISE NOTICE '';
  RAISE NOTICE '📈 Views created:';
  RAISE NOTICE '   - amazon_financial_transactions_latest_sync';
  RAISE NOTICE '   - amazon_financial_sku_sales_summary';
  RAISE NOTICE '   - amazon_financial_daily_sales';
  RAISE NOTICE '   - amazon_financial_velocity_30d';
  RAISE NOTICE '   - amazon_financial_velocity_7d';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 RLS policies enabled for super_admin and admin roles';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Next: Run this SQL, then update API routes for delta sync';
END $$;

