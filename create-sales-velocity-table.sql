-- =====================================================
-- Sales Velocity Analysis Tables
-- =====================================================
-- Stores calculated sales velocity metrics for quick retrieval

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.sales_velocity_metrics CASCADE;
DROP TABLE IF EXISTS public.sales_velocity_calculations CASCADE;

-- =====================================================
-- Sales Velocity Calculation Runs
-- =====================================================
CREATE TABLE public.sales_velocity_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_date DATE NOT NULL UNIQUE, -- Date this calculation was run
    period_start DATE NOT NULL, -- Start of analysis period (e.g., Aug 2024)
    period_end DATE NOT NULL, -- End of analysis period (e.g., today)
    total_skus_analyzed INTEGER DEFAULT 0,
    data_sources JSONB, -- Track which data sources were used
    status TEXT DEFAULT 'completed', -- 'processing', 'completed', 'failed'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Sales Velocity Metrics (Main Table)
-- =====================================================
CREATE TABLE public.sales_velocity_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_id UUID REFERENCES public.sales_velocity_calculations(id) ON DELETE CASCADE,
    calculation_date DATE NOT NULL, -- Date of this calculation
    
    -- SKU Identification
    sku TEXT NOT NULL, -- Internal SKU or Amazon SKU
    asin TEXT, -- Amazon ASIN if available
    product_name TEXT,
    
    -- Sales Velocity Metrics (Historical Period)
    total_units_sold INTEGER DEFAULT 0, -- Total units sold in period
    total_revenue NUMERIC(12, 2) DEFAULT 0, -- Total revenue in period
    days_in_period INTEGER DEFAULT 0, -- Number of days analyzed
    daily_sales_velocity NUMERIC(10, 4) DEFAULT 0, -- Units per day (average)
    weekly_sales_velocity NUMERIC(10, 4) DEFAULT 0, -- Units per week (average)
    monthly_sales_velocity NUMERIC(10, 4) DEFAULT 0, -- Units per month (average)
    
    -- Recent Velocity (Last 30 Days)
    units_sold_30d INTEGER DEFAULT 0,
    revenue_30d NUMERIC(12, 2) DEFAULT 0,
    daily_velocity_30d NUMERIC(10, 4) DEFAULT 0,
    
    -- Recent Velocity (Last 7 Days)
    units_sold_7d INTEGER DEFAULT 0,
    revenue_7d NUMERIC(12, 2) DEFAULT 0,
    daily_velocity_7d NUMERIC(10, 4) DEFAULT 0,
    
    -- Inventory Positions (Current)
    amazon_fba_quantity INTEGER DEFAULT 0, -- Available at Amazon
    amazon_inbound_quantity INTEGER DEFAULT 0, -- On the way to Amazon
    emg_warehouse_quantity INTEGER DEFAULT 0, -- At EMG warehouse
    catv_warehouse_quantity INTEGER DEFAULT 0, -- At CATV warehouse (Active WIP)
    total_available_inventory INTEGER DEFAULT 0, -- Sum of all available
    
    -- Calculated Metrics
    days_of_inventory NUMERIC(10, 2), -- Total inventory / daily velocity
    stockout_risk TEXT, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    reorder_point INTEGER, -- When to reorder (based on lead time)
    recommended_order_quantity INTEGER, -- Suggested order amount
    
    -- Velocity Trends
    velocity_trend TEXT, -- 'INCREASING', 'STABLE', 'DECREASING'
    velocity_change_30d NUMERIC(10, 4), -- Change from previous 30d period
    velocity_change_percent NUMERIC(10, 2), -- Percentage change
    
    -- Financial Metrics
    average_selling_price NUMERIC(10, 2), -- ASP
    inventory_value NUMERIC(12, 2), -- Total inventory value at ASP
    daily_revenue_rate NUMERIC(10, 2), -- Daily revenue based on velocity
    
    -- Metadata
    last_sale_date DATE, -- Most recent sale
    first_sale_date DATE, -- First sale in period
    is_active BOOLEAN DEFAULT TRUE, -- Currently selling
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one metric per SKU per calculation
    UNIQUE(calculation_id, sku)
);

-- =====================================================
-- Indexes for Performance
-- =====================================================
CREATE INDEX idx_velocity_metrics_calculation_id ON public.sales_velocity_metrics(calculation_id);
CREATE INDEX idx_velocity_metrics_sku ON public.sales_velocity_metrics(sku);
CREATE INDEX idx_velocity_metrics_asin ON public.sales_velocity_metrics(asin);
CREATE INDEX idx_velocity_metrics_calculation_date ON public.sales_velocity_metrics(calculation_date);
CREATE INDEX idx_velocity_metrics_stockout_risk ON public.sales_velocity_metrics(stockout_risk);
CREATE INDEX idx_velocity_metrics_days_of_inventory ON public.sales_velocity_metrics(days_of_inventory);
CREATE INDEX idx_velocity_metrics_velocity_trend ON public.sales_velocity_metrics(velocity_trend);

CREATE INDEX idx_velocity_calculations_date ON public.sales_velocity_calculations(calculation_date);
CREATE INDEX idx_velocity_calculations_status ON public.sales_velocity_calculations(status);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================
ALTER TABLE public.sales_velocity_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_velocity_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can see all velocity data
CREATE POLICY "Super admins can view all velocity calculations"
    ON public.sales_velocity_calculations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can insert velocity calculations"
    ON public.sales_velocity_calculations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can view all velocity metrics"
    ON public.sales_velocity_metrics FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can insert velocity metrics"
    ON public.sales_velocity_metrics FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

-- =====================================================
-- Helper View: Latest Velocity Metrics
-- =====================================================
CREATE OR REPLACE VIEW public.sales_velocity_latest AS
WITH latest_calc AS (
    SELECT MAX(calculation_date) as max_date
    FROM public.sales_velocity_calculations
    WHERE status = 'completed'
)
SELECT
    m.sku,
    m.asin,
    m.product_name,
    m.daily_sales_velocity,
    m.weekly_sales_velocity,
    m.monthly_sales_velocity,
    m.daily_velocity_30d,
    m.daily_velocity_7d,
    m.total_available_inventory,
    m.amazon_fba_quantity,
    m.emg_warehouse_quantity,
    m.catv_warehouse_quantity,
    m.days_of_inventory,
    m.stockout_risk,
    m.velocity_trend,
    m.average_selling_price,
    m.daily_revenue_rate,
    m.last_sale_date,
    m.calculation_date
FROM
    public.sales_velocity_metrics m
    INNER JOIN latest_calc lc ON m.calculation_date = lc.max_date
WHERE
    m.is_active = TRUE
ORDER BY
    m.daily_sales_velocity DESC;

-- Grant access to the view
GRANT SELECT ON public.sales_velocity_latest TO authenticated;

-- =====================================================
-- Helper View: Stockout Risk Alert
-- =====================================================
CREATE OR REPLACE VIEW public.sales_velocity_stockout_alerts AS
WITH latest_calc AS (
    SELECT MAX(calculation_date) as max_date
    FROM public.sales_velocity_calculations
    WHERE status = 'completed'
)
SELECT
    m.sku,
    m.product_name,
    m.daily_sales_velocity,
    m.total_available_inventory,
    m.days_of_inventory,
    m.stockout_risk,
    m.reorder_point,
    m.recommended_order_quantity,
    m.amazon_fba_quantity,
    m.amazon_inbound_quantity,
    m.calculation_date
FROM
    public.sales_velocity_metrics m
    INNER JOIN latest_calc lc ON m.calculation_date = lc.max_date
WHERE
    m.is_active = TRUE
    AND m.stockout_risk IN ('HIGH', 'CRITICAL')
    AND m.daily_sales_velocity > 0
ORDER BY
    m.days_of_inventory ASC,
    m.daily_sales_velocity DESC;

-- Grant access to the view
GRANT SELECT ON public.sales_velocity_stockout_alerts TO authenticated;

-- =====================================================
-- Helper View: Top Movers (Fastest Selling)
-- =====================================================
CREATE OR REPLACE VIEW public.sales_velocity_top_movers AS
WITH latest_calc AS (
    SELECT MAX(calculation_date) as max_date
    FROM public.sales_velocity_calculations
    WHERE status = 'completed'
)
SELECT
    m.sku,
    m.product_name,
    m.daily_sales_velocity,
    m.daily_velocity_30d,
    m.daily_velocity_7d,
    m.velocity_trend,
    m.velocity_change_percent,
    m.total_available_inventory,
    m.days_of_inventory,
    m.daily_revenue_rate,
    m.calculation_date
FROM
    public.sales_velocity_metrics m
    INNER JOIN latest_calc lc ON m.calculation_date = lc.max_date
WHERE
    m.is_active = TRUE
    AND m.daily_sales_velocity > 0
ORDER BY
    m.daily_sales_velocity DESC
LIMIT 20;

-- Grant access to the view
GRANT SELECT ON public.sales_velocity_top_movers TO authenticated;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE public.sales_velocity_calculations IS 'Tracks each sales velocity calculation run';
COMMENT ON TABLE public.sales_velocity_metrics IS 'Stores calculated sales velocity metrics per SKU for fast retrieval';
COMMENT ON VIEW public.sales_velocity_latest IS 'Shows the most recent velocity metrics for all active SKUs';
COMMENT ON VIEW public.sales_velocity_stockout_alerts IS 'Shows SKUs at high risk of stockout';
COMMENT ON VIEW public.sales_velocity_top_movers IS 'Shows the top 20 fastest-selling SKUs';

