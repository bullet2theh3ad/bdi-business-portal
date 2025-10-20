-- =====================================================
-- Amazon FBA Inventory Management Tables
-- =====================================================
-- Stores Amazon FBA inventory snapshots for sales velocity analysis

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.amazon_inventory_snapshots CASCADE;
DROP TABLE IF EXISTS public.amazon_inventory_uploads CASCADE;

-- =====================================================
-- Inventory Upload Tracking
-- =====================================================
CREATE TABLE public.amazon_inventory_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID, -- References auth.users(id), no FK constraint
    snapshot_date DATE NOT NULL, -- The date this inventory snapshot represents
    row_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed', -- 'processing', 'completed', 'failed'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Amazon Inventory Snapshots (Main Table)
-- =====================================================
CREATE TABLE public.amazon_inventory_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.amazon_inventory_uploads(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL, -- Date of this inventory snapshot
    
    -- Product Identifiers
    seller_sku TEXT NOT NULL, -- Your SKU (sku column)
    fnsku TEXT, -- Amazon Fulfillment SKU
    asin TEXT, -- Amazon Standard Identification Number
    product_name TEXT,
    condition TEXT, -- 'New', 'Used', etc.
    
    -- Pricing
    your_price NUMERIC(10, 2),
    
    -- MFN (Merchant Fulfilled Network) - Seller fulfilled
    mfn_listing_exists BOOLEAN DEFAULT FALSE,
    mfn_fulfillable_quantity INTEGER DEFAULT 0,
    
    -- AFN (Amazon Fulfilled Network) - FBA
    afn_listing_exists BOOLEAN DEFAULT FALSE,
    afn_warehouse_quantity INTEGER DEFAULT 0, -- Total in warehouse
    afn_fulfillable_quantity INTEGER DEFAULT 0, -- Available to sell
    afn_unsellable_quantity INTEGER DEFAULT 0, -- Damaged/unsellable
    afn_reserved_quantity INTEGER DEFAULT 0, -- Reserved for orders
    afn_total_quantity INTEGER DEFAULT 0, -- Total units
    
    -- Physical Properties
    per_unit_volume NUMERIC(10, 2), -- Cubic feet
    
    -- Inbound Inventory (on the way to Amazon)
    afn_inbound_working_quantity INTEGER DEFAULT 0, -- Being prepared
    afn_inbound_shipped_quantity INTEGER DEFAULT 0, -- Shipped to Amazon
    afn_inbound_receiving_quantity INTEGER DEFAULT 0, -- Being received at Amazon
    
    -- Other Status
    afn_researching_quantity INTEGER DEFAULT 0, -- Under investigation
    afn_reserved_future_supply INTEGER DEFAULT 0, -- Reserved for future
    afn_future_supply_buyable INTEGER DEFAULT 0, -- Future buyable
    
    -- Store/Marketplace
    store TEXT, -- Store identifier if multi-store
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one snapshot per SKU per date per upload
    UNIQUE(upload_id, seller_sku, snapshot_date)
);

-- =====================================================
-- Indexes for Performance
-- =====================================================
CREATE INDEX idx_inventory_snapshots_upload_id ON public.amazon_inventory_snapshots(upload_id);
CREATE INDEX idx_inventory_snapshots_seller_sku ON public.amazon_inventory_snapshots(seller_sku);
CREATE INDEX idx_inventory_snapshots_asin ON public.amazon_inventory_snapshots(asin);
CREATE INDEX idx_inventory_snapshots_fnsku ON public.amazon_inventory_snapshots(fnsku);
CREATE INDEX idx_inventory_snapshots_snapshot_date ON public.amazon_inventory_snapshots(snapshot_date);
CREATE INDEX idx_inventory_snapshots_sku_date ON public.amazon_inventory_snapshots(seller_sku, snapshot_date);

CREATE INDEX idx_inventory_uploads_snapshot_date ON public.amazon_inventory_uploads(snapshot_date);
CREATE INDEX idx_inventory_uploads_status ON public.amazon_inventory_uploads(status);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================
ALTER TABLE public.amazon_inventory_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amazon_inventory_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can see all inventory data
CREATE POLICY "Super admins can view all inventory uploads"
    ON public.amazon_inventory_uploads FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can insert inventory uploads"
    ON public.amazon_inventory_uploads FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can update inventory uploads"
    ON public.amazon_inventory_uploads FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can delete inventory uploads"
    ON public.amazon_inventory_uploads FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

-- Policy: Super admins can see all inventory snapshots
CREATE POLICY "Super admins can view all inventory snapshots"
    ON public.amazon_inventory_snapshots FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can insert inventory snapshots"
    ON public.amazon_inventory_snapshots FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can update inventory snapshots"
    ON public.amazon_inventory_snapshots FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can delete inventory snapshots"
    ON public.amazon_inventory_snapshots FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.auth_id = auth.uid() AND public.users.role = 'super_admin'
        )
    );

-- =====================================================
-- Helper View: Latest Inventory by SKU
-- =====================================================
CREATE OR REPLACE VIEW public.amazon_inventory_latest AS
WITH latest_snapshot AS (
    SELECT MAX(snapshot_date) as max_date
    FROM public.amazon_inventory_snapshots
)
SELECT
    s.seller_sku,
    s.fnsku,
    s.asin,
    s.product_name,
    s.condition,
    s.your_price,
    s.afn_fulfillable_quantity,
    s.afn_reserved_quantity,
    s.afn_unsellable_quantity,
    s.afn_total_quantity,
    s.afn_inbound_working_quantity,
    s.afn_inbound_shipped_quantity,
    s.afn_inbound_receiving_quantity,
    (s.afn_inbound_working_quantity + s.afn_inbound_shipped_quantity + s.afn_inbound_receiving_quantity) as total_inbound,
    s.snapshot_date,
    s.created_at
FROM
    public.amazon_inventory_snapshots s
    INNER JOIN latest_snapshot ls ON s.snapshot_date = ls.max_date
ORDER BY
    s.afn_fulfillable_quantity DESC;

-- Grant access to the view
GRANT SELECT ON public.amazon_inventory_latest TO authenticated;

-- =====================================================
-- Helper View: Inventory Trends (Last 30 Days)
-- =====================================================
CREATE OR REPLACE VIEW public.amazon_inventory_trends AS
SELECT
    seller_sku,
    asin,
    product_name,
    snapshot_date,
    afn_fulfillable_quantity,
    afn_reserved_quantity,
    afn_total_quantity,
    (afn_inbound_working_quantity + afn_inbound_shipped_quantity + afn_inbound_receiving_quantity) as total_inbound,
    LAG(afn_fulfillable_quantity) OVER (PARTITION BY seller_sku ORDER BY snapshot_date) as prev_fulfillable,
    afn_fulfillable_quantity - LAG(afn_fulfillable_quantity) OVER (PARTITION BY seller_sku ORDER BY snapshot_date) as fulfillable_change
FROM
    public.amazon_inventory_snapshots
WHERE
    snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY
    seller_sku, snapshot_date DESC;

-- Grant access to the view
GRANT SELECT ON public.amazon_inventory_trends TO authenticated;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE public.amazon_inventory_uploads IS 'Tracks Amazon FBA inventory CSV file uploads';
COMMENT ON TABLE public.amazon_inventory_snapshots IS 'Stores Amazon FBA inventory snapshots for sales velocity analysis';
COMMENT ON VIEW public.amazon_inventory_latest IS 'Shows the most recent inventory snapshot for each SKU';
COMMENT ON VIEW public.amazon_inventory_trends IS 'Shows inventory changes over the last 30 days per SKU';

