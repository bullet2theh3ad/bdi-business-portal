-- NRE Budgets Table
CREATE TABLE IF NOT EXISTS nre_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nre_reference_number TEXT NOT NULL UNIQUE,
  vendor_name TEXT NOT NULL,
  quote_number TEXT,
  quote_date DATE,
  payment_terms TEXT,
  payment_status TEXT DEFAULT 'not_paid', -- not_paid, partially_paid, paid
  payment_date DATE,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  documents JSONB DEFAULT '[]'::jsonb, -- Array of document paths
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- NRE Budget Line Items Table (separate from the existing nre_line_items for document extraction)
CREATE TABLE IF NOT EXISTS nre_budget_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nre_budget_id UUID REFERENCES nre_budgets(id) ON DELETE CASCADE,
  line_item_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- NRE_DESIGN, TOOLING, EVT_DVT_PVT, CERTIFICATIONS, etc.
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nre_budgets_reference_number ON nre_budgets(nre_reference_number);
CREATE INDEX IF NOT EXISTS idx_nre_budgets_vendor_name ON nre_budgets(vendor_name);
CREATE INDEX IF NOT EXISTS idx_nre_budgets_payment_status ON nre_budgets(payment_status);
CREATE INDEX IF NOT EXISTS idx_nre_budget_line_items_budget_id ON nre_budget_line_items(nre_budget_id);
CREATE INDEX IF NOT EXISTS idx_nre_budget_line_items_category ON nre_budget_line_items(category);

-- RLS Policies
ALTER TABLE nre_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE nre_budget_line_items ENABLE ROW LEVEL SECURITY;

-- Allow BDI super_admins to manage NRE budgets
CREATE POLICY "BDI super_admins can manage NRE budgets"
  ON nre_budgets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
      INNER JOIN organizations o ON om.organization_uuid = o.id
      WHERE u.auth_id = auth.uid()
      AND o.code = 'BDI'
      AND u.role = 'super_admin'
    )
  );

CREATE POLICY "BDI super_admins can manage NRE budget line items"
  ON nre_budget_line_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
      INNER JOIN organizations o ON om.organization_uuid = o.id
      WHERE u.auth_id = auth.uid()
      AND o.code = 'BDI'
      AND u.role = 'super_admin'
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_nre_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nre_budgets_updated_at
  BEFORE UPDATE ON nre_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_nre_budgets_updated_at();

CREATE TRIGGER nre_budget_line_items_updated_at
  BEFORE UPDATE ON nre_budget_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_nre_budgets_updated_at();

COMMENT ON TABLE nre_budgets IS 'Tracks Non-Recurring Engineering budgets and quotes';
COMMENT ON TABLE nre_budget_line_items IS 'Individual line items for NRE budgets with categories';
