-- =====================================================
-- Sales Reports Table
-- Stores external sales reporting dashboard URLs
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.sales_reports CASCADE;

-- Create sales_reports table
CREATE TABLE public.sales_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '📊',
    color TEXT DEFAULT 'blue',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID, -- References auth.users(id) but no FK constraint
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for ordering
CREATE INDEX idx_sales_reports_order ON public.sales_reports(display_order, created_at);
CREATE INDEX idx_sales_reports_active ON public.sales_reports(is_active);

-- Enable RLS
ALTER TABLE public.sales_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only authorized users (scistulli@boundlessdevices.com and dzand@boundlessdevices.com) can access
CREATE POLICY "Authorized users can view sales reports"
    ON public.sales_reports FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE email IN ('scistulli@boundlessdevices.com', 'dzand@boundlessdevices.com')
        )
    );

CREATE POLICY "Authorized users can insert sales reports"
    ON public.sales_reports FOR INSERT
    WITH CHECK (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE email IN ('scistulli@boundlessdevices.com', 'dzand@boundlessdevices.com')
        )
    );

CREATE POLICY "Authorized users can update sales reports"
    ON public.sales_reports FOR UPDATE
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE email IN ('scistulli@boundlessdevices.com', 'dzand@boundlessdevices.com')
        )
    );

CREATE POLICY "Authorized users can delete sales reports"
    ON public.sales_reports FOR DELETE
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE email IN ('scistulli@boundlessdevices.com', 'dzand@boundlessdevices.com')
        )
    );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_sales_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sales_reports_updated_at
    BEFORE UPDATE ON public.sales_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_reports_updated_at();

-- Insert default report
INSERT INTO public.sales_reports (name, url, description, icon, color, display_order, is_active)
VALUES (
    'Harpia Sales Dashboard',
    'https://reports.harpia.co/shared/yW1gQ5NQB2J8dbAj#tab:900448',
    'Main sales reporting and analytics dashboard',
    '📊',
    'blue',
    1,
    true
);

-- Add comment
COMMENT ON TABLE public.sales_reports IS 'External sales reporting dashboard URLs for Business Analysis';

