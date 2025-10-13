-- =====================================================
-- Fix QuickBooks RLS Policies to use public.users table
-- Run this AFTER creating the QuickBooks tables
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

-- Create corrected policies using public.users table
-- QuickBooks Connections
CREATE POLICY "Super admins can view QB connections"
    ON quickbooks_connections FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() 
            AND role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can manage QB connections"
    ON quickbooks_connections FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Sync Logs
CREATE POLICY "Super admins can view sync logs"
    ON quickbooks_sync_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() 
            AND role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can create sync logs"
    ON quickbooks_sync_log FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Customers
CREATE POLICY "Super admins can view QB customers"
    ON quickbooks_customers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() 
            AND role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can manage QB customers"
    ON quickbooks_customers FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Invoices
CREATE POLICY "Super admins can view QB invoices"
    ON quickbooks_invoices FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() 
            AND role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can manage QB invoices"
    ON quickbooks_invoices FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Vendors
CREATE POLICY "Super admins can view QB vendors"
    ON quickbooks_vendors FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() 
            AND role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can manage QB vendors"
    ON quickbooks_vendors FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Expenses
CREATE POLICY "Super admins can view QB expenses"
    ON quickbooks_expenses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() 
            AND role = 'super_admin'
        )
    );

CREATE POLICY "Super admins can manage QB expenses"
    ON quickbooks_expenses FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Success message
SELECT 'QuickBooks RLS policies fixed successfully! Users table now references public.users instead of auth.users.' as status;

