-- =============================================================================
-- SKU Financial Scenarios Table
-- =============================================================================
-- Purpose: Store SKU financial analysis scenarios with detailed cost breakdowns
-- This enables users to create, save, and compare profitability models for different
-- SKU/Channel/Country combinations.
-- =============================================================================

-- Drop existing table if re-creating (use with caution in production)
-- DROP TABLE IF EXISTS sku_financial_scenarios CASCADE;

-- Main scenarios table
CREATE TABLE IF NOT EXISTS sku_financial_scenarios (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Scenario Metadata
  scenario_name VARCHAR(255) NOT NULL, -- User-friendly name for the scenario
  description TEXT, -- Optional notes about this scenario
  
  -- SKU & Market Selection
  sku_name VARCHAR(255) NOT NULL, -- SKU code or custom SKU name
  channel VARCHAR(255) NOT NULL, -- Sales channel (amazon_fba, shopify, etc. or custom)
  country_code VARCHAR(3) NOT NULL DEFAULT 'US', -- ISO country code
  
  -- Section 1: Pricing & Deductions (Input)
  asp DECIMAL(12, 2) NOT NULL DEFAULT 0.00, -- Average Selling Price
  reseller_margin_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00, -- Reseller margin %
  marketing_reserve_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00, -- Marketing reserve %
  fulfillment_costs DECIMAL(12, 2) NOT NULL DEFAULT 0.00, -- Fulfillment costs
  
  -- Section 2: Calculated Deductions (stored for historical reference)
  reseller_deduction DECIMAL(12, 2) GENERATED ALWAYS AS (asp * reseller_margin_percent / 100) STORED,
  marketing_deduction DECIMAL(12, 2) GENERATED ALWAYS AS (asp * marketing_reserve_percent / 100) STORED,
  total_deductions DECIMAL(12, 2) GENERATED ALWAYS AS (
    (asp * reseller_margin_percent / 100) + 
    (asp * marketing_reserve_percent / 100) + 
    fulfillment_costs
  ) STORED,
  
  -- Section 3: Net Receipts (Calculated)
  net_receipts DECIMAL(12, 2) GENERATED ALWAYS AS (
    asp - (
      (asp * reseller_margin_percent / 100) + 
      (asp * marketing_reserve_percent / 100) + 
      fulfillment_costs
    )
  ) STORED,
  
  -- Section 4: Product Costs (Input)
  product_cost_fob DECIMAL(12, 2) NOT NULL DEFAULT 0.00, -- Product cost (FOB)
  sw_license_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00, -- Software license fee
  other_product_costs JSONB DEFAULT '[]'::jsonb, -- Array of {label: string, value: number}
  
  -- Section 5: Royalty (Calculated - 5% of Net Receipts)
  royalty DECIMAL(12, 2) GENERATED ALWAYS AS (
    (asp - (
      (asp * reseller_margin_percent / 100) + 
      (asp * marketing_reserve_percent / 100) + 
      fulfillment_costs
    )) * 0.05
  ) STORED,
  
  -- Section 6: Cost of Goods Sold (Input)
  returns_freight DECIMAL(12, 2) NOT NULL DEFAULT 13.00,
  returns_handling DECIMAL(12, 2) NOT NULL DEFAULT 0.45,
  doa_channel_credit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  financing_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  pps_handling_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  inbound_shipping_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  outbound_shipping_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  greenfile_marketing DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  other_cogs JSONB DEFAULT '[]'::jsonb, -- Array of {label: string, value: number}
  
  -- Audit & Access Control
  created_by UUID NOT NULL REFERENCES users(auth_id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- Optional org association
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Soft Delete & Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_template BOOLEAN NOT NULL DEFAULT FALSE, -- Mark as reusable template
  
  -- Version Control (for future scenario versioning)
  version INTEGER NOT NULL DEFAULT 1,
  parent_scenario_id UUID REFERENCES sku_financial_scenarios(id) ON DELETE SET NULL -- For scenario cloning/versioning
);

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

-- Index on user for "My Scenarios" queries
CREATE INDEX IF NOT EXISTS idx_sku_financial_scenarios_created_by 
  ON sku_financial_scenarios(created_by);

-- Index on organization for org-level scenario access
CREATE INDEX IF NOT EXISTS idx_sku_financial_scenarios_organization_id 
  ON sku_financial_scenarios(organization_id);

-- Index on SKU name for filtering by SKU
CREATE INDEX IF NOT EXISTS idx_sku_financial_scenarios_sku_name 
  ON sku_financial_scenarios(sku_name);

-- Index on channel for filtering by channel
CREATE INDEX IF NOT EXISTS idx_sku_financial_scenarios_channel 
  ON sku_financial_scenarios(channel);

-- Index on country for filtering by country
CREATE INDEX IF NOT EXISTS idx_sku_financial_scenarios_country_code 
  ON sku_financial_scenarios(country_code);

-- Index on is_active for filtering active scenarios
CREATE INDEX IF NOT EXISTS idx_sku_financial_scenarios_is_active 
  ON sku_financial_scenarios(is_active);

-- Index on is_template for template queries
CREATE INDEX IF NOT EXISTS idx_sku_financial_scenarios_is_template 
  ON sku_financial_scenarios(is_template);

-- Composite index for common queries (user + active scenarios)
CREATE INDEX IF NOT EXISTS idx_sku_financial_scenarios_user_active 
  ON sku_financial_scenarios(created_by, is_active, created_at DESC);

-- JSONB GIN indexes for searching within dynamic fields
CREATE INDEX IF NOT EXISTS idx_sku_financial_scenarios_other_product_costs 
  ON sku_financial_scenarios USING GIN (other_product_costs);

CREATE INDEX IF NOT EXISTS idx_sku_financial_scenarios_other_cogs 
  ON sku_financial_scenarios USING GIN (other_cogs);

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to calculate total product costs (including other costs)
CREATE OR REPLACE FUNCTION calculate_total_product_costs(scenario sku_financial_scenarios)
RETURNS DECIMAL(12, 2) AS $$
DECLARE
  other_costs_sum DECIMAL(12, 2) := 0;
  item JSONB;
BEGIN
  -- Sum up other product costs from JSONB array
  FOR item IN SELECT * FROM jsonb_array_elements(scenario.other_product_costs)
  LOOP
    other_costs_sum := other_costs_sum + COALESCE((item->>'value')::DECIMAL(12, 2), 0);
  END LOOP;
  
  RETURN scenario.product_cost_fob + scenario.sw_license_fee + other_costs_sum;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate total CoGS (including other CoGS)
CREATE OR REPLACE FUNCTION calculate_total_cogs(scenario sku_financial_scenarios)
RETURNS DECIMAL(12, 2) AS $$
DECLARE
  other_cogs_sum DECIMAL(12, 2) := 0;
  item JSONB;
BEGIN
  -- Sum up other CoGS from JSONB array
  FOR item IN SELECT * FROM jsonb_array_elements(scenario.other_cogs)
  LOOP
    other_cogs_sum := other_cogs_sum + COALESCE((item->>'value')::DECIMAL(12, 2), 0);
  END LOOP;
  
  RETURN scenario.returns_freight + 
         scenario.returns_handling + 
         scenario.doa_channel_credit + 
         scenario.financing_cost + 
         scenario.pps_handling_fee + 
         scenario.inbound_shipping_cost + 
         scenario.outbound_shipping_cost + 
         scenario.greenfile_marketing + 
         other_cogs_sum;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate gross profit
CREATE OR REPLACE FUNCTION calculate_gross_profit(scenario sku_financial_scenarios)
RETURNS DECIMAL(12, 2) AS $$
BEGIN
  RETURN scenario.net_receipts - scenario.royalty - calculate_total_cogs(scenario);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate gross margin percentage
CREATE OR REPLACE FUNCTION calculate_gross_margin(scenario sku_financial_scenarios)
RETURNS DECIMAL(5, 2) AS $$
BEGIN
  IF scenario.net_receipts = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN (calculate_gross_profit(scenario) / scenario.net_receipts) * 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- Helper View for Easy Querying with Calculated Fields
-- =============================================================================

CREATE OR REPLACE VIEW sku_financial_scenarios_with_calculations AS
SELECT 
  s.*,
  calculate_total_product_costs(s) AS total_product_costs,
  calculate_total_cogs(s) AS total_cogs,
  calculate_gross_profit(s) AS gross_profit,
  calculate_gross_margin(s) AS gross_margin_percent,
  u.name AS creator_name,
  u.email AS creator_email,
  o.name AS organization_name,
  o.code AS organization_code
FROM sku_financial_scenarios s
LEFT JOIN users u ON s.created_by = u.auth_id
LEFT JOIN organizations o ON s.organization_id = o.id
WHERE s.is_active = TRUE
ORDER BY s.created_at DESC;

-- =============================================================================
-- Row Level Security (RLS) Policies
-- =============================================================================

-- Enable RLS
ALTER TABLE sku_financial_scenarios ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own scenarios
CREATE POLICY "Users can view own scenarios"
  ON sku_financial_scenarios
  FOR SELECT
  USING (
    auth.uid() = created_by
    OR 
    -- Allow org members to see scenarios if org-shared
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_auth_id = auth.uid()
      AND om.organization_uuid = sku_financial_scenarios.organization_id
    )
    OR
    -- Allow super_admins to see all
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role = 'super_admin'
    )
  );

-- Policy: Users can create scenarios
CREATE POLICY "Users can create scenarios"
  ON sku_financial_scenarios
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
  );

-- Policy: Users can update their own scenarios
CREATE POLICY "Users can update own scenarios"
  ON sku_financial_scenarios
  FOR UPDATE
  USING (
    auth.uid() = created_by
    OR
    -- Allow super_admins to update all
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role = 'super_admin'
    )
  );

-- Policy: Users can delete their own scenarios (soft delete recommended)
CREATE POLICY "Users can delete own scenarios"
  ON sku_financial_scenarios
  FOR DELETE
  USING (
    auth.uid() = created_by
    OR
    -- Allow super_admins to delete all
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role = 'super_admin'
    )
  );

-- =============================================================================
-- Trigger for updated_at timestamp
-- =============================================================================

CREATE OR REPLACE FUNCTION update_sku_financial_scenarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sku_financial_scenarios_updated_at
  BEFORE UPDATE ON sku_financial_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION update_sku_financial_scenarios_updated_at();

-- =============================================================================
-- Sample Data (Optional - for testing)
-- =============================================================================

-- COMMENT OUT IN PRODUCTION
/*
INSERT INTO sku_financial_scenarios (
  scenario_name,
  description,
  sku_name,
  channel,
  country_code,
  asp,
  reseller_margin_percent,
  marketing_reserve_percent,
  fulfillment_costs,
  product_cost_fob,
  sw_license_fee,
  other_product_costs,
  returns_freight,
  returns_handling,
  doa_channel_credit,
  financing_cost,
  pps_handling_fee,
  inbound_shipping_cost,
  outbound_shipping_cost,
  greenfile_marketing,
  other_cogs,
  created_by,
  organization_id
) VALUES (
  'MNQ15-30W Amazon FBA US - Q1 2025',
  'Base scenario for Amazon FBA sales in US market',
  'MNQ15-30W-U',
  'amazon_fba',
  'US',
  179.99,
  15.00,
  5.00,
  12.50,
  65.00,
  2.50,
  '[{"label": "Packaging", "value": 3.50}, {"label": "Accessories", "value": 8.00}]'::jsonb,
  13.00,
  0.45,
  5.00,
  1.25,
  0.75,
  8.00,
  6.50,
  2.00,
  '[{"label": "Customer Support", "value": 1.50}, {"label": "Insurance", "value": 0.80}]'::jsonb,
  (SELECT auth_id FROM users WHERE email = 'scistulli@boundlessdevices.com' LIMIT 1),
  (SELECT id FROM organizations WHERE code = 'BDI' LIMIT 1)
);
*/

-- =============================================================================
-- Verification Queries
-- =============================================================================

-- Check table structure
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'sku_financial_scenarios'
-- ORDER BY ordinal_position;

-- Test calculated fields with view
-- SELECT * FROM sku_financial_scenarios_with_calculations LIMIT 5;

-- =============================================================================
-- Notes
-- =============================================================================

/*
JSONB Field Formats:

other_product_costs: Array of cost line items
[
  {"label": "Packaging", "value": 3.50},
  {"label": "Accessories", "value": 8.00}
]

other_cogs: Array of CoGS line items
[
  {"label": "Customer Support", "value": 1.50},
  {"label": "Insurance", "value": 0.80}
]

Benefits of This Schema:
1. ✅ All data in one table (simple queries)
2. ✅ Calculated fields use GENERATED columns (always accurate)
3. ✅ JSONB for flexible dynamic line items
4. ✅ Full audit trail with created_by, created_at, updated_at
5. ✅ Soft delete with is_active flag
6. ✅ Template support for reusable scenarios
7. ✅ Versioning support with parent_scenario_id
8. ✅ Organization-level sharing support
9. ✅ RLS policies for data security
10. ✅ Helper functions for complex calculations
11. ✅ View with all calculations pre-computed
12. ✅ Comprehensive indexes for performance
*/

