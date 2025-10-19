-- =====================================================
-- SKU Financial Scenarios - Schema Update
-- =====================================================
-- This script updates the sku_financial_scenarios table to match
-- the Excel-based structure with Amazon fees, ACOS, and new cost categories
-- =====================================================

-- Drop the old table (WARNING: This will delete all existing scenarios!)
-- Comment this out if you want to preserve old data
DROP TABLE IF EXISTS public.sku_financial_scenarios CASCADE;

-- Create the new table with updated schema
CREATE TABLE IF NOT EXISTS public.sku_financial_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Metadata
  scenario_name TEXT NOT NULL,
  description TEXT,
  
  -- Basic Info
  sku_name TEXT NOT NULL,
  channel TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'US',
  
  -- ===== TOP SECTION =====
  asp NUMERIC(15, 2) NOT NULL DEFAULT 0,
  
  -- FBA Fee (% and $)
  fba_fee_percent NUMERIC(5, 2) DEFAULT 8.00,
  fba_fee_amount NUMERIC(15, 2) DEFAULT 0,
  
  -- Amazon Referral Fee (% and $)
  amazon_referral_fee_percent NUMERIC(5, 2) DEFAULT 8.00,
  amazon_referral_fee_amount NUMERIC(15, 2) DEFAULT 0,
  
  -- ACOS (% and $)
  acos_percent NUMERIC(5, 2) DEFAULT 8.00,
  acos_amount NUMERIC(15, 2) DEFAULT 0,
  
  -- ===== LESS FRONTEND SECTION =====
  -- Motorola Royalties (% of Net Sales and $)
  motorola_royalties_percent NUMERIC(5, 2) DEFAULT 5.00,
  motorola_royalties_amount NUMERIC(15, 2) DEFAULT 0,
  
  -- RTV Costs
  rtv_freight_assumptions NUMERIC(15, 2) DEFAULT 0.80,
  rtv_repair_costs NUMERIC(15, 2) DEFAULT 2.93,
  
  -- DOA Credits (% and $)
  doa_credits_percent NUMERIC(5, 2) DEFAULT 0,
  doa_credits_amount NUMERIC(15, 2) DEFAULT 0,
  
  -- Other Frontend Costs
  invoice_factoring_net NUMERIC(15, 2) DEFAULT 0,
  
  -- Sales Commissions (% and $)
  sales_commissions_percent NUMERIC(5, 2) DEFAULT 0,
  sales_commissions_amount NUMERIC(15, 2) DEFAULT 0,
  
  -- Dynamic Other Frontend Costs (JSONB array)
  other_frontend_costs JSONB DEFAULT '[]'::jsonb,
  
  -- ===== LANDED DDP CALCULATIONS SECTION =====
  -- Import Duties (% of ExWorks and $)
  import_duties_percent NUMERIC(5, 2) DEFAULT 0,
  import_duties_amount NUMERIC(15, 2) DEFAULT 0,
  
  -- ExWorks and Shipping
  ex_works_standard NUMERIC(15, 2) DEFAULT 0,
  import_shipping_sea NUMERIC(15, 2) DEFAULT 0,
  
  -- Software
  gryphon_software NUMERIC(15, 2) DEFAULT 2.50,
  
  -- Dynamic Other Landed Costs (JSONB array)
  other_landed_costs JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_sku_financial_scenarios_user_id 
  ON public.sku_financial_scenarios(user_id);

CREATE INDEX IF NOT EXISTS idx_sku_financial_scenarios_sku_name 
  ON public.sku_financial_scenarios(sku_name);

CREATE INDEX IF NOT EXISTS idx_sku_financial_scenarios_channel 
  ON public.sku_financial_scenarios(channel);

CREATE INDEX IF NOT EXISTS idx_sku_financial_scenarios_created_at 
  ON public.sku_financial_scenarios(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE public.sku_financial_scenarios ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own scenarios" ON public.sku_financial_scenarios;
DROP POLICY IF EXISTS "Users can create their own scenarios" ON public.sku_financial_scenarios;
DROP POLICY IF EXISTS "Users can update their own scenarios" ON public.sku_financial_scenarios;
DROP POLICY IF EXISTS "Users can delete their own scenarios" ON public.sku_financial_scenarios;

-- Allow users to view their own scenarios
CREATE POLICY "Users can view their own scenarios"
  ON public.sku_financial_scenarios
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to create scenarios
CREATE POLICY "Users can create their own scenarios"
  ON public.sku_financial_scenarios
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own scenarios
CREATE POLICY "Users can update their own scenarios"
  ON public.sku_financial_scenarios
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow users to delete their own scenarios
CREATE POLICY "Users can delete their own scenarios"
  ON public.sku_financial_scenarios
  FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- CALCULATED FIELDS (Optional - for reporting)
-- =====================================================
-- You can add computed columns or create views for calculated fields

-- Example: Create a view with calculated fields
CREATE OR REPLACE VIEW public.sku_financial_scenarios_with_calculations AS
SELECT 
  s.*,
  -- Net Sales = ASP - FBA Fee - Amazon Referral Fee - ACOS
  (s.asp - s.fba_fee_amount - s.amazon_referral_fee_amount - s.acos_amount) AS net_sales,
  
  -- Total Backend Costs (calculated)
  (s.motorola_royalties_amount + s.rtv_freight_assumptions + s.rtv_repair_costs + 
   s.doa_credits_amount + s.invoice_factoring_net + s.sales_commissions_amount) AS total_backend_costs,
  
  -- Total Frontend Costs (backend costs + other frontend costs - note: other_frontend_costs is JSONB so needs special handling)
  (s.motorola_royalties_amount + s.rtv_freight_assumptions + s.rtv_repair_costs + 
   s.doa_credits_amount + s.invoice_factoring_net + s.sales_commissions_amount) AS total_frontend_costs,
  
  -- Landed DDP
  (s.ex_works_standard + s.import_duties_amount + s.import_shipping_sea + s.gryphon_software) AS landed_ddp,
  
  -- Gross Profit = Net Sales - Total Frontend Costs - Landed DDP
  ((s.asp - s.fba_fee_amount - s.amazon_referral_fee_amount - s.acos_amount) - 
   (s.motorola_royalties_amount + s.rtv_freight_assumptions + s.rtv_repair_costs + 
    s.doa_credits_amount + s.invoice_factoring_net + s.sales_commissions_amount) - 
   (s.ex_works_standard + s.import_duties_amount + s.import_shipping_sea + s.gryphon_software)) AS gross_profit,
  
  -- Gross Margin % = (Gross Profit / Net Sales) * 100
  CASE 
    WHEN (s.asp - s.fba_fee_amount - s.amazon_referral_fee_amount - s.acos_amount) > 0 THEN 
      (((s.asp - s.fba_fee_amount - s.amazon_referral_fee_amount - s.acos_amount) - 
        (s.motorola_royalties_amount + s.rtv_freight_assumptions + s.rtv_repair_costs + 
         s.doa_credits_amount + s.invoice_factoring_net + s.sales_commissions_amount) - 
        (s.ex_works_standard + s.import_duties_amount + s.import_shipping_sea + s.gryphon_software)) / 
       (s.asp - s.fba_fee_amount - s.amazon_referral_fee_amount - s.acos_amount)) * 100
    ELSE 0
  END AS gross_margin_percent
FROM public.sku_financial_scenarios s;

-- Grant access to the view
GRANT SELECT ON public.sku_financial_scenarios_with_calculations TO authenticated;

-- =====================================================
-- COMMENTS (Documentation)
-- =====================================================
COMMENT ON TABLE public.sku_financial_scenarios IS 'Stores SKU financial analysis scenarios with Amazon fees, ACOS, and detailed cost breakdowns';

COMMENT ON COLUMN public.sku_financial_scenarios.fba_fee_percent IS 'FBA Fee as percentage of ASP';
COMMENT ON COLUMN public.sku_financial_scenarios.fba_fee_amount IS 'FBA Fee dollar amount (auto-calculated from percent or manually entered)';
COMMENT ON COLUMN public.sku_financial_scenarios.amazon_referral_fee_percent IS 'Amazon Referral Fee as percentage of ASP';
COMMENT ON COLUMN public.sku_financial_scenarios.amazon_referral_fee_amount IS 'Amazon Referral Fee dollar amount';
COMMENT ON COLUMN public.sku_financial_scenarios.acos_percent IS 'Advertising Cost of Sale (ACOS) as percentage of ASP';
COMMENT ON COLUMN public.sku_financial_scenarios.acos_amount IS 'ACOS dollar amount';
COMMENT ON COLUMN public.sku_financial_scenarios.motorola_royalties_percent IS 'Motorola Royalties as percentage of Net Sales';
COMMENT ON COLUMN public.sku_financial_scenarios.motorola_royalties_amount IS 'Motorola Royalties dollar amount';
COMMENT ON COLUMN public.sku_financial_scenarios.other_frontend_costs IS 'Dynamic array of other frontend cost line items [{label: string, value: number}]';
COMMENT ON COLUMN public.sku_financial_scenarios.import_duties_percent IS 'Import Duties as percentage of ExWorks Standard';
COMMENT ON COLUMN public.sku_financial_scenarios.import_duties_amount IS 'Import Duties dollar amount';
COMMENT ON COLUMN public.sku_financial_scenarios.other_landed_costs IS 'Dynamic array of other landed cost line items [{label: string, value: number}]';

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================
-- Uncomment to insert sample data
/*
INSERT INTO public.sku_financial_scenarios (
  user_id,
  scenario_name,
  description,
  sku_name,
  channel,
  country_code,
  asp,
  fba_fee_percent,
  fba_fee_amount,
  amazon_referral_fee_percent,
  amazon_referral_fee_amount,
  acos_percent,
  acos_amount,
  motorola_royalties_percent,
  motorola_royalties_amount,
  rtv_freight_assumptions,
  rtv_repair_costs,
  ex_works_standard,
  import_shipping_sea,
  gryphon_software
) VALUES (
  auth.uid(), -- Replace with actual user ID
  'MG8702 Amazon FBA Scenario',
  'Financial analysis for MG8702 on Amazon FBA',
  'MG8702',
  'amazon_fba',
  'US',
  277.00,
  8.00,
  22.16,
  8.00,
  22.16,
  8.00,
  22.16,
  5.00,
  11.28,
  0.80,
  2.93,
  136.50,
  2.30,
  2.50
);
*/

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify the schema was created correctly

-- Check table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'sku_financial_scenarios'
ORDER BY ordinal_position;

-- Check indexes
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'sku_financial_scenarios';

-- Check RLS policies
SELECT 
  policyname, 
  cmd, 
  qual, 
  with_check
FROM pg_policies
WHERE tablename = 'sku_financial_scenarios';

-- =====================================================
-- MIGRATION NOTES
-- =====================================================
/*
BREAKING CHANGES:
- This is a complete schema redesign
- Old data structure is incompatible
- All existing scenarios will be lost if you drop the old table

MIGRATION STRATEGY (if you need to preserve old data):
1. Backup existing data:
   CREATE TABLE sku_financial_scenarios_backup AS 
   SELECT * FROM sku_financial_scenarios;

2. Run this script to create new schema

3. Write custom migration script to map old fields to new fields
   (This will require manual mapping as the structures are different)

NEW FEATURES:
- Percentage AND dollar amount fields for flexible input
- Amazon-specific fees (FBA Fee, Referral Fee, ACOS)
- Separate frontend and landed cost sections
- Dynamic line items for "Other" costs
- Calculated view for reporting
- Better documentation and comments
*/

