-- Budget Targets/Estimates Table
-- This is separate from nre_budgets (which tracks actuals)
-- This tracks ESTIMATED/TARGET budget numbers for comparison and analysis

CREATE TABLE IF NOT EXISTS budget_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Project Identification
  project_name TEXT NOT NULL, -- e.g., "MNQ15 DVT", "MNB10 EVT"
  sku_code TEXT, -- Link to product_skus if applicable
  fiscal_year INTEGER NOT NULL, -- e.g., 2025, 2026
  fiscal_quarter INTEGER, -- 1, 2, 3, 4 (optional)
  
  -- Budget Metadata
  budget_category TEXT NOT NULL DEFAULT 'NRE_GENERAL', -- NRE_DESIGN, TOOLING, EVT_DVT_PVT, etc.
  budget_description TEXT, -- Description of what this budget covers
  
  -- Budget Amounts
  total_budget_amount NUMERIC(15, 2) NOT NULL, -- Total estimated budget
  
  -- Payment Timeline Preference
  payment_frequency TEXT DEFAULT 'monthly', -- 'weekly', 'monthly', 'quarterly', 'custom'
  start_date DATE, -- When budget period starts
  end_date DATE, -- When budget period ends
  
  -- Notes & Context
  notes TEXT,
  assumptions TEXT, -- Budget assumptions and rationale
  
  -- Status
  status TEXT DEFAULT 'draft', -- draft, active, closed, archived
  is_locked BOOLEAN DEFAULT false, -- Lock budget from editing
  
  -- Audit
  created_by UUID REFERENCES users(auth_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Budget Target Payment Schedule - weekly/monthly breakdown
CREATE TABLE IF NOT EXISTS budget_target_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_target_id UUID REFERENCES budget_targets(id) ON DELETE CASCADE,
  
  -- Payment Period
  payment_number INTEGER NOT NULL, -- 1, 2, 3... (sequential)
  payment_period_start DATE NOT NULL,
  payment_period_end DATE NOT NULL,
  payment_label TEXT, -- "Week 1", "January 2025", "Q1-2025", etc.
  
  -- Estimated Amount
  estimated_amount NUMERIC(12, 2) NOT NULL,
  
  -- Notes
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Budget vs Actual Comparison View (for analytics)
CREATE OR REPLACE VIEW budget_vs_actual_analysis AS
SELECT 
  bt.id as budget_target_id,
  bt.project_name,
  bt.sku_code,
  bt.budget_category,
  bt.fiscal_year,
  bt.total_budget_amount as target_amount,
  
  -- Aggregate actuals from nre_budgets
  COALESCE(SUM(nb.total_amount), 0) as actual_amount,
  
  -- Calculate variance
  bt.total_budget_amount - COALESCE(SUM(nb.total_amount), 0) as variance_amount,
  CASE 
    WHEN bt.total_budget_amount > 0 
    THEN ((bt.total_budget_amount - COALESCE(SUM(nb.total_amount), 0)) / bt.total_budget_amount * 100)
    ELSE 0 
  END as variance_percentage,
  
  -- Status indicators
  CASE 
    WHEN COALESCE(SUM(nb.total_amount), 0) > bt.total_budget_amount THEN 'OVER_BUDGET'
    WHEN COALESCE(SUM(nb.total_amount), 0) >= (bt.total_budget_amount * 0.9) THEN 'NEAR_BUDGET'
    WHEN COALESCE(SUM(nb.total_amount), 0) > 0 THEN 'UNDER_BUDGET'
    ELSE 'NO_ACTUALS'
  END as budget_status,
  
  bt.status,
  bt.created_at,
  bt.updated_at
  
FROM budget_targets bt
LEFT JOIN nre_budgets nb ON 
  (nb.project_name = bt.project_name OR nb.sku_code = bt.sku_code)
  AND nb.deleted_at IS NULL
  AND EXTRACT(YEAR FROM nb.created_at) = bt.fiscal_year
WHERE bt.deleted_at IS NULL
GROUP BY bt.id, bt.project_name, bt.sku_code, bt.budget_category, bt.fiscal_year, bt.total_budget_amount, bt.status, bt.created_at, bt.updated_at;

-- Budget Target Category Summary
CREATE OR REPLACE VIEW budget_category_summary AS
SELECT 
  budget_category,
  fiscal_year,
  COUNT(*) as project_count,
  SUM(total_budget_amount) as total_budget,
  AVG(total_budget_amount) as avg_budget,
  MIN(total_budget_amount) as min_budget,
  MAX(total_budget_amount) as max_budget
FROM budget_targets
WHERE deleted_at IS NULL
  AND status = 'active'
GROUP BY budget_category, fiscal_year
ORDER BY fiscal_year DESC, total_budget DESC;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_budget_targets_project_name ON budget_targets(project_name);
CREATE INDEX IF NOT EXISTS idx_budget_targets_sku_code ON budget_targets(sku_code);
CREATE INDEX IF NOT EXISTS idx_budget_targets_fiscal_year ON budget_targets(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_budget_targets_category ON budget_targets(budget_category);
CREATE INDEX IF NOT EXISTS idx_budget_targets_status ON budget_targets(status);
CREATE INDEX IF NOT EXISTS idx_budget_target_payments_budget_id ON budget_target_payments(budget_target_id);
CREATE INDEX IF NOT EXISTS idx_budget_target_payments_period ON budget_target_payments(payment_period_start, payment_period_end);

-- RLS Policies
ALTER TABLE budget_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_target_payments ENABLE ROW LEVEL SECURITY;

-- BDI super_admins and CFOs can manage budget targets
CREATE POLICY "BDI admins can manage budget targets"
  ON budget_targets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
      INNER JOIN organizations o ON om.organization_uuid = o.id
      WHERE u.auth_id = auth.uid()
      AND o.code = 'BDI'
      AND (u.role IN ('super_admin') OR om.role IN ('admin_cfo', 'admin'))
    )
  );

CREATE POLICY "BDI admins can manage budget target payments"
  ON budget_target_payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
      INNER JOIN organizations o ON om.organization_uuid = o.id
      WHERE u.auth_id = auth.uid()
      AND o.code = 'BDI'
      AND (u.role IN ('super_admin') OR om.role IN ('admin_cfo', 'admin'))
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_budget_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budget_targets_updated_at
  BEFORE UPDATE ON budget_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_targets_updated_at();

CREATE TRIGGER budget_target_payments_updated_at
  BEFORE UPDATE ON budget_target_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_targets_updated_at();

COMMENT ON TABLE budget_targets IS 'Estimated/target budget numbers for projects - compare against nre_budgets (actuals)';
COMMENT ON TABLE budget_target_payments IS 'Payment schedule breakdown for budget targets (weekly/monthly estimates)';
COMMENT ON VIEW budget_vs_actual_analysis IS 'Comparison view between budget targets and actual NRE spending';

