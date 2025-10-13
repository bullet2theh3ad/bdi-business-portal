-- =====================================================
-- Simplified QuickBooks RLS Policies
-- Since feature flag already restricts to Steve only,
-- just allow authenticated users
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Super admins can view QB connections" ON quickbooks_connections;
DROP POLICY IF EXISTS "Super admins can manage QB connections" ON quickbooks_connections;
DROP POLICY IF EXISTS "Super admins can view sync logs" ON quickbooks_sync_log;
DROP POLICY IF EXISTS "Super admins can create sync logs" ON quickbooks_sync_log;
DROP POLICY IF EXISTS "Super admins can view QB customers" ON quickbooks_customers;
DROP POLICY IF EXISTS "Super admins can manage QB customers" ON quickbooks_customers;
DROP POLICY IF EXISTS "Super admins can view QB invoices" ON quickbooks_invoices;
DROP POLICY IF EXISTS "Super admins can manage QB invoices" ON quickbooks_invoices;
DROP POLICY IF EXISTS "Super admins can view QB vendors" ON quickbooks_vendors;
DROP POLICY IF EXISTS "Super admins can manage QB vendors" ON quickbooks_vendors;
DROP POLICY IF EXISTS "Super admins can view QB expenses" ON quickbooks_expenses;
DROP POLICY IF EXISTS "Super admins can manage QB expenses" ON quickbooks_expenses;

-- Create simplified policies - allow authenticated users
-- (Feature flag already restricts to Steve only)

CREATE POLICY "Authenticated users can access QB connections"
    ON quickbooks_connections FOR ALL
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can access QB sync logs"
    ON quickbooks_sync_log FOR ALL
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can access QB customers"
    ON quickbooks_customers FOR ALL
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can access QB invoices"
    ON quickbooks_invoices FOR ALL
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can access QB vendors"
    ON quickbooks_vendors FOR ALL
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can access QB expenses"
    ON quickbooks_expenses FOR ALL
    USING (auth.uid() IS NOT NULL);

-- Success message
SELECT 'QuickBooks RLS policies simplified - authenticated users can access (feature flag controls visibility)' as status;

