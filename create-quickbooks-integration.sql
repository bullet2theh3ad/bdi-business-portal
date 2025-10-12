-- =====================================================
-- QuickBooks Integration Tables
-- Phase 1: OAuth & Connection Management
-- =====================================================

-- QuickBooks Connections (OAuth tokens & company info)
CREATE TABLE IF NOT EXISTS quickbooks_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Company Information
    realm_id TEXT NOT NULL, -- QuickBooks Company ID
    company_name TEXT,
    company_email TEXT,
    company_country TEXT,
    
    -- OAuth Tokens (encrypted in production)
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    
    -- Connection Status
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT, -- 'success', 'failed', 'in_progress'
    last_sync_error TEXT,
    
    -- Metadata
    connected_by UUID REFERENCES auth.users(id),
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure only one active connection per company
    CONSTRAINT unique_active_realm UNIQUE (realm_id)
);

-- QuickBooks Sync Log (track all sync operations)
CREATE TABLE IF NOT EXISTS quickbooks_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
    
    -- Sync Details
    sync_type TEXT NOT NULL, -- 'customers', 'invoices', 'vendors', 'expenses', 'full'
    status TEXT NOT NULL, -- 'started', 'completed', 'failed'
    records_fetched INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    
    -- Error Tracking
    error_message TEXT,
    error_details JSONB,
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Metadata
    triggered_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- QuickBooks Customers (synced from QB)
CREATE TABLE IF NOT EXISTS quickbooks_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
    
    -- QuickBooks IDs
    qb_customer_id TEXT NOT NULL,
    qb_sync_token TEXT, -- For update detection
    
    -- Customer Details
    display_name TEXT NOT NULL,
    company_name TEXT,
    given_name TEXT,
    family_name TEXT,
    
    -- Contact Info
    primary_email TEXT,
    primary_phone TEXT,
    website TEXT,
    
    -- Address
    billing_address JSONB,
    shipping_address JSONB,
    
    -- Financial
    balance DECIMAL(15, 2) DEFAULT 0,
    currency_code TEXT DEFAULT 'USD',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Sync Metadata
    qb_created_at TIMESTAMPTZ,
    qb_updated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_qb_customer UNIQUE (connection_id, qb_customer_id)
);

-- QuickBooks Invoices (synced from QB)
CREATE TABLE IF NOT EXISTS quickbooks_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
    
    -- QuickBooks IDs
    qb_invoice_id TEXT NOT NULL,
    qb_sync_token TEXT,
    qb_doc_number TEXT, -- Invoice number
    
    -- Customer Reference
    qb_customer_id TEXT NOT NULL,
    customer_id UUID REFERENCES quickbooks_customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    
    -- Invoice Details
    invoice_date DATE,
    due_date DATE,
    
    -- Financial
    total_amount DECIMAL(15, 2) NOT NULL,
    balance DECIMAL(15, 2) DEFAULT 0,
    currency_code TEXT DEFAULT 'USD',
    
    -- Status
    status TEXT, -- 'draft', 'pending', 'paid', 'overdue', 'voided'
    
    -- Line Items (stored as JSON for flexibility)
    line_items JSONB,
    
    -- Payment Tracking
    payment_status TEXT,
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    
    -- Sync Metadata
    qb_created_at TIMESTAMPTZ,
    qb_updated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_qb_invoice UNIQUE (connection_id, qb_invoice_id)
);

-- QuickBooks Vendors (synced from QB)
CREATE TABLE IF NOT EXISTS quickbooks_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
    
    -- QuickBooks IDs
    qb_vendor_id TEXT NOT NULL,
    qb_sync_token TEXT,
    
    -- Vendor Details
    display_name TEXT NOT NULL,
    company_name TEXT,
    
    -- Contact Info
    primary_email TEXT,
    primary_phone TEXT,
    website TEXT,
    
    -- Address
    billing_address JSONB,
    
    -- Financial
    balance DECIMAL(15, 2) DEFAULT 0,
    currency_code TEXT DEFAULT 'USD',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Sync Metadata
    qb_created_at TIMESTAMPTZ,
    qb_updated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_qb_vendor UNIQUE (connection_id, qb_vendor_id)
);

-- QuickBooks Expenses (synced from QB)
CREATE TABLE IF NOT EXISTS quickbooks_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
    
    -- QuickBooks IDs
    qb_expense_id TEXT NOT NULL,
    qb_sync_token TEXT,
    
    -- Expense Details
    expense_date DATE,
    payment_type TEXT, -- 'Cash', 'Check', 'CreditCard'
    
    -- Vendor Reference
    qb_vendor_id TEXT,
    vendor_id UUID REFERENCES quickbooks_vendors(id) ON DELETE SET NULL,
    vendor_name TEXT,
    
    -- Financial
    total_amount DECIMAL(15, 2) NOT NULL,
    currency_code TEXT DEFAULT 'USD',
    
    -- Category/Account
    account_ref TEXT,
    category TEXT,
    
    -- Description
    memo TEXT,
    line_items JSONB,
    
    -- Sync Metadata
    qb_created_at TIMESTAMPTZ,
    qb_updated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_qb_expense UNIQUE (connection_id, qb_expense_id)
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

CREATE INDEX idx_qb_connections_realm ON quickbooks_connections(realm_id);
CREATE INDEX idx_qb_connections_active ON quickbooks_connections(is_active);

CREATE INDEX idx_qb_sync_log_connection ON quickbooks_sync_log(connection_id);
CREATE INDEX idx_qb_sync_log_status ON quickbooks_sync_log(status);
CREATE INDEX idx_qb_sync_log_started ON quickbooks_sync_log(started_at DESC);

CREATE INDEX idx_qb_customers_connection ON quickbooks_customers(connection_id);
CREATE INDEX idx_qb_customers_qb_id ON quickbooks_customers(qb_customer_id);
CREATE INDEX idx_qb_customers_email ON quickbooks_customers(primary_email);

CREATE INDEX idx_qb_invoices_connection ON quickbooks_invoices(connection_id);
CREATE INDEX idx_qb_invoices_qb_id ON quickbooks_invoices(qb_invoice_id);
CREATE INDEX idx_qb_invoices_customer ON quickbooks_invoices(customer_id);
CREATE INDEX idx_qb_invoices_date ON quickbooks_invoices(invoice_date DESC);
CREATE INDEX idx_qb_invoices_status ON quickbooks_invoices(status);

CREATE INDEX idx_qb_vendors_connection ON quickbooks_vendors(connection_id);
CREATE INDEX idx_qb_vendors_qb_id ON quickbooks_vendors(qb_vendor_id);

CREATE INDEX idx_qb_expenses_connection ON quickbooks_expenses(connection_id);
CREATE INDEX idx_qb_expenses_qb_id ON quickbooks_expenses(qb_expense_id);
CREATE INDEX idx_qb_expenses_date ON quickbooks_expenses(expense_date DESC);

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

ALTER TABLE quickbooks_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_expenses ENABLE ROW LEVEL SECURITY;

-- Only Super Admins can access QuickBooks data (for now)
-- Later: Can be expanded to specific users via feature flag

CREATE POLICY "Super admins can view QB connections"
    ON quickbooks_connections FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Super admins can manage QB connections"
    ON quickbooks_connections FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Super admins can view sync logs"
    ON quickbooks_sync_log FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Super admins can create sync logs"
    ON quickbooks_sync_log FOR INSERT
    WITH CHECK (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Super admins can view QB customers"
    ON quickbooks_customers FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Super admins can manage QB customers"
    ON quickbooks_customers FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Super admins can view QB invoices"
    ON quickbooks_invoices FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Super admins can manage QB invoices"
    ON quickbooks_invoices FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Super admins can view QB vendors"
    ON quickbooks_vendors FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Super admins can manage QB vendors"
    ON quickbooks_vendors FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Super admins can view QB expenses"
    ON quickbooks_expenses FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Super admins can manage QB expenses"
    ON quickbooks_expenses FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' = 'super_admin'
        )
    );

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to refresh OAuth token
CREATE OR REPLACE FUNCTION refresh_quickbooks_token(connection_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- This will be implemented in the API layer
    -- Just a placeholder for future token refresh logic
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark connection as inactive
CREATE OR REPLACE FUNCTION deactivate_quickbooks_connection(connection_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE quickbooks_connections
    SET is_active = false,
        updated_at = NOW()
    WHERE id = connection_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE quickbooks_connections IS 'QuickBooks OAuth connections and company info';
COMMENT ON TABLE quickbooks_sync_log IS 'Log of all QuickBooks sync operations';
COMMENT ON TABLE quickbooks_customers IS 'Customer data synced from QuickBooks';
COMMENT ON TABLE quickbooks_invoices IS 'Invoice data synced from QuickBooks';
COMMENT ON TABLE quickbooks_vendors IS 'Vendor data synced from QuickBooks';
COMMENT ON TABLE quickbooks_expenses IS 'Expense data synced from QuickBooks';

