-- =====================================================
-- Cash Flow Must Pay Items Table
-- =====================================================
-- Stores weekly "Must Pay" expenses for cash flow runway
-- Categories: Labor, OpEx, R&D, Marketing, Cert, Other
-- These are manual entries or CSV imports that aggregate
-- from other sources (e.g., QuickBooks invoices)
-- =====================================================

-- Create enum for Must Pay categories
CREATE TYPE must_pay_category AS ENUM (
  'labor',
  'opex',
  'r&d',
  'marketing',
  'cert',
  'other'
);

-- Create the cash_flow_must_pays table
CREATE TABLE IF NOT EXISTS cash_flow_must_pays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Week identifier (Monday of the week)
  week_start DATE NOT NULL,
  
  -- Category
  category must_pay_category NOT NULL,
  
  -- Description/notes (e.g., "Invoices", "Biweekly Payroll", etc.)
  description TEXT,
  
  -- Amount in USD
  amount NUMERIC(15, 2) NOT NULL,
  
  -- Organization and user tracking
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Source tracking (for future integrations)
  source_type VARCHAR(50) DEFAULT 'manual', -- 'manual', 'csv', 'quickbooks', etc.
  source_reference VARCHAR(255), -- Invoice #, PO #, etc.
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_cash_flow_must_pays_week_start ON cash_flow_must_pays(week_start);
CREATE INDEX idx_cash_flow_must_pays_organization ON cash_flow_must_pays(organization_id);
CREATE INDEX idx_cash_flow_must_pays_category ON cash_flow_must_pays(category);
CREATE INDEX idx_cash_flow_must_pays_week_org ON cash_flow_must_pays(week_start, organization_id);

-- Add RLS policies
ALTER TABLE cash_flow_must_pays ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view Must Pay items for their organization
CREATE POLICY "Users can view must pays for their organization"
  ON cash_flow_must_pays
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- Policy: Users can create Must Pay items for their organization
CREATE POLICY "Users can create must pays for their organization"
  ON cash_flow_must_pays
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- Policy: Users can update Must Pay items for their organization
CREATE POLICY "Users can update must pays for their organization"
  ON cash_flow_must_pays
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- Policy: Users can delete Must Pay items for their organization
CREATE POLICY "Users can delete must pays for their organization"
  ON cash_flow_must_pays
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- =====================================================
-- Weekly Cash Flow Summary View (Optional - for convenience)
-- =====================================================
-- This view aggregates NRE, Inventory, and Must Pays by week
-- Note: This is just a convenience view - you can also calculate
-- in the application layer
-- =====================================================

CREATE OR REPLACE VIEW weekly_cash_flow_summary AS
WITH 
  -- NRE payments by week
  nre_weekly AS (
    SELECT 
      DATE_TRUNC('week', payment_date::date)::date AS week_start,
      SUM(amount) AS nre_total
    FROM nre_budget_payment_line_items
    GROUP BY DATE_TRUNC('week', payment_date::date)
  ),
  -- Inventory payments by week
  inventory_weekly AS (
    SELECT 
      DATE_TRUNC('week', payment_date::date)::date AS week_start,
      SUM(amount::numeric) AS inventory_total
    FROM inventory_payment_line_items
    GROUP BY DATE_TRUNC('week', payment_date::date)
  ),
  -- Must Pay items by week
  must_pay_weekly AS (
    SELECT 
      week_start,
      SUM(amount) AS must_pay_total,
      -- Breakdown by category
      SUM(CASE WHEN category = 'labor' THEN amount ELSE 0 END) AS labor_total,
      SUM(CASE WHEN category = 'opex' THEN amount ELSE 0 END) AS opex_total,
      SUM(CASE WHEN category = 'r&d' THEN amount ELSE 0 END) AS rnd_total,
      SUM(CASE WHEN category = 'marketing' THEN amount ELSE 0 END) AS marketing_total,
      SUM(CASE WHEN category = 'cert' THEN amount ELSE 0 END) AS cert_total,
      SUM(CASE WHEN category = 'other' THEN amount ELSE 0 END) AS other_total
    FROM cash_flow_must_pays
    GROUP BY week_start
  )
SELECT 
  COALESCE(n.week_start, i.week_start, m.week_start) AS week_start,
  COALESCE(n.nre_total, 0) AS nre_total,
  COALESCE(i.inventory_total, 0) AS inventory_total,
  COALESCE(m.must_pay_total, 0) AS must_pay_total,
  COALESCE(m.labor_total, 0) AS labor_total,
  COALESCE(m.opex_total, 0) AS opex_total,
  COALESCE(m.rnd_total, 0) AS rnd_total,
  COALESCE(m.marketing_total, 0) AS marketing_total,
  COALESCE(m.cert_total, 0) AS cert_total,
  COALESCE(m.other_total, 0) AS other_total,
  COALESCE(n.nre_total, 0) + COALESCE(i.inventory_total, 0) + COALESCE(m.must_pay_total, 0) AS week_total
FROM nre_weekly n
FULL OUTER JOIN inventory_weekly i ON n.week_start = i.week_start
FULL OUTER JOIN must_pay_weekly m ON COALESCE(n.week_start, i.week_start) = m.week_start
ORDER BY week_start;

-- Grant access to the view
GRANT SELECT ON weekly_cash_flow_summary TO authenticated;

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE cash_flow_must_pays IS 'Weekly Must Pay expenses for cash flow runway calculation';
COMMENT ON COLUMN cash_flow_must_pays.week_start IS 'Monday of the week (ISO week start)';
COMMENT ON COLUMN cash_flow_must_pays.category IS 'Top-level category: labor, opex, r&d, marketing, cert, other';
COMMENT ON COLUMN cash_flow_must_pays.description IS 'Description or source (e.g., Invoices, Biweekly Payroll)';
COMMENT ON COLUMN cash_flow_must_pays.source_type IS 'Data source: manual, csv, quickbooks, etc.';
COMMENT ON COLUMN cash_flow_must_pays.source_reference IS 'Reference to source document (Invoice #, PO #, etc.)';

