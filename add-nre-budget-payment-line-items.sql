-- Add payment line items table for NRE budgets
CREATE TABLE IF NOT EXISTS nre_budget_payment_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nre_budget_id UUID NOT NULL REFERENCES nre_budgets(id) ON DELETE CASCADE,
  payment_number INTEGER NOT NULL,
  payment_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_nre_budget_payment_line_items_budget_id ON nre_budget_payment_line_items(nre_budget_id);
CREATE INDEX idx_nre_budget_payment_line_items_payment_date ON nre_budget_payment_line_items(payment_date);

-- Add RLS policies (same as nre_budgets - only BDI super_admin, admin_cfo, admin_nre)
ALTER TABLE nre_budget_payment_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "BDI admins can view payment line items"
  ON nre_budget_payment_line_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN organization_members om ON om.user_auth_id = u.auth_id
      INNER JOIN organizations o ON o.id = om.organization_uuid
      WHERE u.auth_id = auth.uid()
        AND o.code = 'BDI'
        AND o.type = 'internal'
        AND u.role IN ('super_admin', 'admin_cfo', 'admin_nre')
    )
  );

CREATE POLICY "BDI admins can insert payment line items"
  ON nre_budget_payment_line_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN organization_members om ON om.user_auth_id = u.auth_id
      INNER JOIN organizations o ON o.id = om.organization_uuid
      WHERE u.auth_id = auth.uid()
        AND o.code = 'BDI'
        AND o.type = 'internal'
        AND u.role IN ('super_admin', 'admin_cfo', 'admin_nre')
    )
  );

CREATE POLICY "BDI admins can update payment line items"
  ON nre_budget_payment_line_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN organization_members om ON om.user_auth_id = u.auth_id
      INNER JOIN organizations o ON o.id = om.organization_uuid
      WHERE u.auth_id = auth.uid()
        AND o.code = 'BDI'
        AND o.type = 'internal'
        AND u.role IN ('super_admin', 'admin_cfo', 'admin_nre')
    )
  );

CREATE POLICY "BDI admins can delete payment line items"
  ON nre_budget_payment_line_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      INNER JOIN organization_members om ON om.user_auth_id = u.auth_id
      INNER JOIN organizations o ON o.id = om.organization_uuid
      WHERE u.auth_id = auth.uid()
        AND o.code = 'BDI'
        AND o.type = 'internal'
        AND u.role IN ('super_admin', 'admin_cfo', 'admin_nre')
    )
  );
