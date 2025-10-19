-- =====================================================
-- Amazon Advertising Campaign Data Tables
-- =====================================================
-- This schema stores Amazon Sponsored Products campaign data
-- uploaded from Amazon Advertising Console CSV exports

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.amazon_campaign_data CASCADE;
DROP TABLE IF EXISTS public.amazon_campaign_uploads CASCADE;

-- =====================================================
-- Campaign Upload Tracking
-- =====================================================
CREATE TABLE public.amazon_campaign_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID, -- References auth.users(id), no FK constraint
    row_count INTEGER DEFAULT 0,
    date_range_start DATE,
    date_range_end DATE,
    status TEXT DEFAULT 'completed', -- 'processing', 'completed', 'failed'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Campaign Data (Main Table)
-- =====================================================
CREATE TABLE public.amazon_campaign_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.amazon_campaign_uploads(id) ON DELETE CASCADE,
    
    -- Campaign Identification
    campaign_name TEXT NOT NULL,
    extracted_sku TEXT, -- Parsed from campaign name (e.g., "MQ20", "MG8702")
    country TEXT, -- 'United States', 'Canada'
    state TEXT, -- 'ENABLED', 'PAUSED'
    status TEXT, -- 'CAMPAIGN_STATUS_ENABLED', 'CAMPAIGN_PAUSED', etc.
    campaign_type TEXT, -- 'SP' (Sponsored Products)
    targeting TEXT, -- 'MANUAL', 'AUTOMATIC'
    
    -- Campaign Settings
    bidding_strategy TEXT,
    start_date DATE,
    end_date DATE,
    avg_time_in_budget NUMERIC(10, 2),
    budget_converted NUMERIC(10, 2),
    budget_original TEXT, -- e.g., "CA$15.00"
    cost_type TEXT, -- 'CPC'
    
    -- Performance Metrics
    impressions INTEGER DEFAULT 0,
    top_of_search_impression_share TEXT, -- e.g., "<5%", "7.74%"
    top_of_search_bid_adjustment NUMERIC(10, 2),
    clicks INTEGER DEFAULT 0,
    ctr NUMERIC(10, 6), -- Click-through rate
    
    -- Spend Metrics
    spend_converted NUMERIC(10, 2), -- USD converted
    spend_original TEXT, -- Original currency (e.g., "CA$59.03")
    cpc_converted NUMERIC(10, 2), -- Cost per click (USD)
    cpc_original TEXT,
    
    -- Conversion Metrics
    detail_page_views INTEGER DEFAULT 0,
    orders INTEGER DEFAULT 0,
    sales_converted NUMERIC(10, 2), -- USD converted
    sales_original TEXT, -- Original currency
    
    -- Efficiency Metrics
    acos NUMERIC(10, 4), -- Advertising Cost of Sales (0.3649 = 36.49%)
    roas NUMERIC(10, 4), -- Return on Ad Spend
    
    -- New-to-Brand Metrics
    ntb_orders INTEGER DEFAULT 0,
    percent_orders_ntb NUMERIC(10, 2),
    ntb_sales_converted NUMERIC(10, 2),
    ntb_sales_original TEXT,
    percent_sales_ntb NUMERIC(10, 2),
    
    -- Long-term Metrics
    long_term_sales_converted NUMERIC(10, 2),
    long_term_sales_original TEXT,
    long_term_roas NUMERIC(10, 4),
    
    -- Video Metrics (mostly 0 for Sponsored Products)
    cumulative_reach INTEGER DEFAULT 0,
    household_reach INTEGER DEFAULT 0,
    viewable_impressions INTEGER DEFAULT 0,
    cpm_converted NUMERIC(10, 2),
    cpm_original TEXT,
    vcpm_converted NUMERIC(10, 2),
    vcpm_original TEXT,
    video_first_quartile INTEGER DEFAULT 0,
    video_midpoint INTEGER DEFAULT 0,
    video_third_quartile INTEGER DEFAULT 0,
    video_complete INTEGER DEFAULT 0,
    video_unmute INTEGER DEFAULT 0,
    vtr NUMERIC(10, 6),
    vctr NUMERIC(10, 6),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes for Performance
-- =====================================================
CREATE INDEX idx_campaign_data_upload_id ON public.amazon_campaign_data(upload_id);
CREATE INDEX idx_campaign_data_sku ON public.amazon_campaign_data(extracted_sku);
CREATE INDEX idx_campaign_data_country ON public.amazon_campaign_data(country);
CREATE INDEX idx_campaign_data_state ON public.amazon_campaign_data(state);
CREATE INDEX idx_campaign_data_start_date ON public.amazon_campaign_data(start_date);
CREATE INDEX idx_campaign_data_campaign_name ON public.amazon_campaign_data(campaign_name);

CREATE INDEX idx_campaign_uploads_date ON public.amazon_campaign_uploads(upload_date);
CREATE INDEX idx_campaign_uploads_status ON public.amazon_campaign_uploads(status);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================
ALTER TABLE public.amazon_campaign_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amazon_campaign_data ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can see all campaign data
CREATE POLICY "Super admins can view all campaign uploads"
    ON public.amazon_campaign_uploads FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can insert campaign uploads"
    ON public.amazon_campaign_uploads FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can update campaign uploads"
    ON public.amazon_campaign_uploads FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can delete campaign uploads"
    ON public.amazon_campaign_uploads FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

-- Policy: Super admins can see all campaign data
CREATE POLICY "Super admins can view all campaign data"
    ON public.amazon_campaign_data FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can insert campaign data"
    ON public.amazon_campaign_data FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can update campaign data"
    ON public.amazon_campaign_data FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can delete campaign data"
    ON public.amazon_campaign_data FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

-- =====================================================
-- Helper View: Campaign Summary by SKU
-- =====================================================
CREATE OR REPLACE VIEW public.amazon_campaign_summary_by_sku AS
SELECT
    extracted_sku,
    country,
    COUNT(DISTINCT campaign_name) AS campaign_count,
    SUM(impressions) AS total_impressions,
    SUM(clicks) AS total_clicks,
    CASE 
        WHEN SUM(impressions) > 0 THEN SUM(clicks)::NUMERIC / SUM(impressions)::NUMERIC
        ELSE 0
    END AS avg_ctr,
    SUM(spend_converted) AS total_spend,
    SUM(sales_converted) AS total_sales,
    SUM(orders) AS total_orders,
    CASE 
        WHEN SUM(sales_converted) > 0 THEN SUM(spend_converted) / SUM(sales_converted)
        ELSE 0
    END AS avg_acos,
    CASE 
        WHEN SUM(spend_converted) > 0 THEN SUM(sales_converted) / SUM(spend_converted)
        ELSE 0
    END AS avg_roas
FROM
    public.amazon_campaign_data
WHERE
    extracted_sku IS NOT NULL
    AND state = 'ENABLED'
GROUP BY
    extracted_sku, country
ORDER BY
    total_spend DESC;

-- Grant access to the view
GRANT SELECT ON public.amazon_campaign_summary_by_sku TO authenticated;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE public.amazon_campaign_uploads IS 'Tracks Amazon Advertising campaign CSV file uploads';
COMMENT ON TABLE public.amazon_campaign_data IS 'Stores detailed Amazon Sponsored Products campaign performance data';
COMMENT ON VIEW public.amazon_campaign_summary_by_sku IS 'Aggregated campaign metrics by SKU for quick analysis';

