-- Add new columns to sku_financial_scenarios table
-- This is a safe migration that adds new columns without dropping existing data

-- Add new marketplace fee columns
ALTER TABLE public.sku_financial_scenarios
ADD COLUMN IF NOT EXISTS fba_fee_percent NUMERIC(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fba_fee_amount NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS amazon_referral_fee_percent NUMERIC(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS amazon_referral_fee_amount NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS acos_percent NUMERIC(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS acos_amount NUMERIC(15, 2) DEFAULT 0;

-- Add new backend cost columns
ALTER TABLE public.sku_financial_scenarios
ADD COLUMN IF NOT EXISTS motorola_royalties_percent NUMERIC(5, 2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS motorola_royalties_amount NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS rtv_freight_assumptions NUMERIC(15, 2) DEFAULT 0.80,
ADD COLUMN IF NOT EXISTS rtv_repair_costs NUMERIC(15, 2) DEFAULT 2.93,
ADD COLUMN IF NOT EXISTS doa_credits_percent NUMERIC(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS doa_credits_amount NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS invoice_factoring_net NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_commissions_percent NUMERIC(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_commissions_amount NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_frontend_costs JSONB DEFAULT '[]'::jsonb;

-- Add new landed DDP columns
ALTER TABLE public.sku_financial_scenarios
ADD COLUMN IF NOT EXISTS import_duties_percent NUMERIC(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS import_duties_amount NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ex_works_standard NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS import_shipping_sea NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gryphon_software NUMERIC(15, 2) DEFAULT 2.50,
ADD COLUMN IF NOT EXISTS other_landed_costs JSONB DEFAULT '[]'::jsonb;

-- Add user_id column if it doesn't exist (for RLS)
ALTER TABLE public.sku_financial_scenarios
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);

-- Update user_id for existing records (if any exist)
-- Skip this if there are no existing records or if user_id is already set
-- UPDATE public.sku_financial_scenarios
-- SET user_id = u.id
-- FROM public.users u
-- WHERE sku_financial_scenarios.some_user_reference = u.auth_id
-- AND sku_financial_scenarios.user_id IS NULL;

-- Create index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_sku_financial_scenarios_user_id 
ON public.sku_financial_scenarios(user_id);

-- Enable RLS if not already enabled
ALTER TABLE public.sku_financial_scenarios ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own scenarios" ON public.sku_financial_scenarios;
DROP POLICY IF EXISTS "Users can create their own scenarios" ON public.sku_financial_scenarios;
DROP POLICY IF EXISTS "Users can update their own scenarios" ON public.sku_financial_scenarios;
DROP POLICY IF EXISTS "Users can delete their own scenarios" ON public.sku_financial_scenarios;

-- Create RLS policies
CREATE POLICY "Users can view their own scenarios"
ON public.sku_financial_scenarios
FOR SELECT
USING (auth.uid() = (SELECT auth_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can create their own scenarios"
ON public.sku_financial_scenarios
FOR INSERT
WITH CHECK (auth.uid() = (SELECT auth_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can update their own scenarios"
ON public.sku_financial_scenarios
FOR UPDATE
USING (auth.uid() = (SELECT auth_id FROM public.users WHERE id = user_id));

CREATE POLICY "Users can delete their own scenarios"
ON public.sku_financial_scenarios
FOR DELETE
USING (auth.uid() = (SELECT auth_id FROM public.users WHERE id = user_id));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sku_financial_scenarios TO authenticated;

