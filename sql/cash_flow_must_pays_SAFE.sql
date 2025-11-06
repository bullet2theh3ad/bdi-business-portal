-- =====================================================
-- Cash Flow Runway Tables - SAFE VERSION
-- This version checks for existing types before creating
-- =====================================================

-- Create enum for Must Pay categories (safe)
DO $$ BEGIN
    CREATE TYPE must_pay_category AS ENUM (
      'labor',
      'opex',
      'r&d',
      'marketing',
      'cert',
      'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for Funding Request types (safe)
DO $$ BEGIN
    CREATE TYPE funding_request_type AS ENUM (
      'lt_notes_payable',
      'st_notes_payable',
      'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for Non-Operating Disbursement types (safe)
DO $$ BEGIN
    CREATE TYPE non_operating_disbursement_type AS ENUM (
      'notes_repayment',
      'interest_payments',
      'distributions',
      'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
CREATE INDEX IF NOT EXISTS idx_cash_flow_must_pays_week_start ON cash_flow_must_pays(week_start);
CREATE INDEX IF NOT EXISTS idx_cash_flow_must_pays_organization ON cash_flow_must_pays(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_must_pays_category ON cash_flow_must_pays(category);
CREATE INDEX IF NOT EXISTS idx_cash_flow_must_pays_week_org ON cash_flow_must_pays(week_start, organization_id);

-- Create funding requests table
CREATE TABLE IF NOT EXISTS cash_flow_funding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Week identifier (Monday of the week)
  week_start DATE NOT NULL,
  
  -- Type of funding request
  funding_type funding_request_type NOT NULL,
  
  -- Description/notes
  description TEXT,
  
  -- Amount in USD
  amount NUMERIC(15, 2) NOT NULL,
  
  -- Is this calculated or manual?
  is_calculated BOOLEAN DEFAULT false,
  
  -- If calculated, what's the logic? (for reference)
  calculation_note TEXT,
  
  -- Organization and user tracking
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funding_requests_week_start ON cash_flow_funding_requests(week_start);
CREATE INDEX IF NOT EXISTS idx_funding_requests_organization ON cash_flow_funding_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_funding_requests_week_org ON cash_flow_funding_requests(week_start, organization_id);

-- Create non-operating disbursements table
CREATE TABLE IF NOT EXISTS cash_flow_non_operating_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Week identifier (Monday of the week)
  week_start DATE NOT NULL,
  
  -- Type of disbursement
  disbursement_type non_operating_disbursement_type NOT NULL,
  
  -- Description/notes (e.g., "Repayment Plan", "Monthly Invoice (TR)", "Quarterly Distribution Schedule")
  description TEXT,
  
  -- Amount in USD
  amount NUMERIC(15, 2) NOT NULL,
  
  -- Organization and user tracking
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Source tracking
  source_reference VARCHAR(255), -- Invoice #, Payment Plan #, etc.
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_non_op_disbursements_week_start ON cash_flow_non_operating_disbursements(week_start);
CREATE INDEX IF NOT EXISTS idx_non_op_disbursements_organization ON cash_flow_non_operating_disbursements(organization_id);
CREATE INDEX IF NOT EXISTS idx_non_op_disbursements_week_org ON cash_flow_non_operating_disbursements(week_start, organization_id);

-- Create bank balances table
CREATE TABLE IF NOT EXISTS cash_flow_bank_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Week identifier (Monday of the week)
  week_start DATE NOT NULL,
  
  -- Beginning Bank Balance (include all bank accounts)
  beginning_balance NUMERIC(15, 2) NOT NULL,
  
  -- Outstanding checks (bank recon to update)
  outstanding_checks NUMERIC(15, 2) DEFAULT 0,
  
  -- Notes/description
  notes TEXT,
  
  -- Organization and user tracking
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure only one balance entry per week per organization
  UNIQUE(week_start, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_balances_week_start ON cash_flow_bank_balances(week_start);
CREATE INDEX IF NOT EXISTS idx_bank_balances_organization ON cash_flow_bank_balances(organization_id);

-- =====================================================
-- RLS Policies for Must Pays
-- =====================================================

ALTER TABLE cash_flow_must_pays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view must pays for their organization" ON cash_flow_must_pays;
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

DROP POLICY IF EXISTS "Users can create must pays for their organization" ON cash_flow_must_pays;
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

DROP POLICY IF EXISTS "Users can update must pays for their organization" ON cash_flow_must_pays;
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

DROP POLICY IF EXISTS "Users can delete must pays for their organization" ON cash_flow_must_pays;
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
-- RLS Policies for Funding Requests
-- =====================================================

ALTER TABLE cash_flow_funding_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view funding requests for their organization" ON cash_flow_funding_requests;
CREATE POLICY "Users can view funding requests for their organization"
  ON cash_flow_funding_requests
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create funding requests for their organization" ON cash_flow_funding_requests;
CREATE POLICY "Users can create funding requests for their organization"
  ON cash_flow_funding_requests
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update funding requests for their organization" ON cash_flow_funding_requests;
CREATE POLICY "Users can update funding requests for their organization"
  ON cash_flow_funding_requests
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete funding requests for their organization" ON cash_flow_funding_requests;
CREATE POLICY "Users can delete funding requests for their organization"
  ON cash_flow_funding_requests
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- =====================================================
-- RLS Policies for Non-Operating Disbursements
-- =====================================================

ALTER TABLE cash_flow_non_operating_disbursements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view non-op disbursements for their organization" ON cash_flow_non_operating_disbursements;
CREATE POLICY "Users can view non-op disbursements for their organization"
  ON cash_flow_non_operating_disbursements
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create non-op disbursements for their organization" ON cash_flow_non_operating_disbursements;
CREATE POLICY "Users can create non-op disbursements for their organization"
  ON cash_flow_non_operating_disbursements
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update non-op disbursements for their organization" ON cash_flow_non_operating_disbursements;
CREATE POLICY "Users can update non-op disbursements for their organization"
  ON cash_flow_non_operating_disbursements
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete non-op disbursements for their organization" ON cash_flow_non_operating_disbursements;
CREATE POLICY "Users can delete non-op disbursements for their organization"
  ON cash_flow_non_operating_disbursements
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- =====================================================
-- RLS Policies for Bank Balances
-- =====================================================

ALTER TABLE cash_flow_bank_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view bank balances for their organization" ON cash_flow_bank_balances;
CREATE POLICY "Users can view bank balances for their organization"
  ON cash_flow_bank_balances
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create bank balances for their organization" ON cash_flow_bank_balances;
CREATE POLICY "Users can create bank balances for their organization"
  ON cash_flow_bank_balances
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update bank balances for their organization" ON cash_flow_bank_balances;
CREATE POLICY "Users can update bank balances for their organization"
  ON cash_flow_bank_balances
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete bank balances for their organization" ON cash_flow_bank_balances;
CREATE POLICY "Users can delete bank balances for their organization"
  ON cash_flow_bank_balances
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- =====================================================
-- Enhanced Weekly Cash Flow Summary View
-- =====================================================

DROP VIEW IF EXISTS weekly_cash_flow_summary;

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
      SUM(amount) AS must_pay_total
    FROM cash_flow_must_pays
    GROUP BY week_start
  ),
  -- Funding requests by week
  funding_weekly AS (
    SELECT
      week_start,
      SUM(amount) AS total_funding_request,
      SUM(CASE WHEN funding_type = 'lt_notes_payable' THEN amount ELSE 0 END) AS lt_notes,
      SUM(CASE WHEN funding_type = 'st_notes_payable' THEN amount ELSE 0 END) AS st_notes
    FROM cash_flow_funding_requests
    GROUP BY week_start
  ),
  -- Non-operating disbursements by week
  non_op_weekly AS (
    SELECT
      week_start,
      SUM(amount) AS total_non_op_disbursements,
      SUM(CASE WHEN disbursement_type = 'notes_repayment' THEN amount ELSE 0 END) AS notes_repayment,
      SUM(CASE WHEN disbursement_type = 'interest_payments' THEN amount ELSE 0 END) AS interest_payments,
      SUM(CASE WHEN disbursement_type = 'distributions' THEN amount ELSE 0 END) AS distributions
    FROM cash_flow_non_operating_disbursements
    GROUP BY week_start
  )
SELECT 
  COALESCE(n.week_start, i.week_start, m.week_start, f.week_start, no.week_start) AS week_start,
  
  -- Operating Cash Outflows
  COALESCE(n.nre_total, 0) AS nre_total,
  COALESCE(i.inventory_total, 0) AS inventory_total,
  COALESCE(m.must_pay_total, 0) AS must_pay_total,
  COALESCE(n.nre_total, 0) + COALESCE(i.inventory_total, 0) + COALESCE(m.must_pay_total, 0) AS total_operating_outflows,
  
  -- Funding Requests
  COALESCE(f.total_funding_request, 0) AS total_funding_request,
  COALESCE(f.lt_notes, 0) AS lt_notes_funding,
  COALESCE(f.st_notes, 0) AS st_notes_funding,
  
  -- Non-Operating Disbursements
  COALESCE(no.total_non_op_disbursements, 0) AS total_non_op_disbursements,
  COALESCE(no.notes_repayment, 0) AS notes_repayment,
  COALESCE(no.interest_payments, 0) AS interest_payments,
  COALESCE(no.distributions, 0) AS distributions,
  
  -- NET CASH FLOW = (Operating Outflows are negative) + Funding - Non-Op Disbursements
  (-1 * (COALESCE(n.nre_total, 0) + COALESCE(i.inventory_total, 0) + COALESCE(m.must_pay_total, 0))) 
  + COALESCE(f.total_funding_request, 0) 
  - COALESCE(no.total_non_op_disbursements, 0) AS net_cash_flow
  
FROM nre_weekly n
FULL OUTER JOIN inventory_weekly i ON n.week_start = i.week_start
FULL OUTER JOIN must_pay_weekly m ON COALESCE(n.week_start, i.week_start) = m.week_start
FULL OUTER JOIN funding_weekly f ON COALESCE(n.week_start, i.week_start, m.week_start) = f.week_start
FULL OUTER JOIN non_op_weekly no ON COALESCE(n.week_start, i.week_start, m.week_start, f.week_start) = no.week_start
ORDER BY week_start;

GRANT SELECT ON weekly_cash_flow_summary TO authenticated;

-- Success message
DO $$ BEGIN
    RAISE NOTICE '✅ Cash Flow Runway tables created successfully!';
END $$;

