-- ==========================================
-- Fix QuickBooks RLS Policies
-- Allow BDI users to read QuickBooks data
-- ==========================================

-- Check if RLS is enabled on QuickBooks tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename LIKE 'quickbooks%'
ORDER BY tablename;

-- ==========================================
-- OPTION 1: Disable RLS entirely (simplest)
-- ==========================================
ALTER TABLE quickbooks_connections DISABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_terms DISABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_classes DISABLE ROW LEVEL SECURITY;

-- If you have other quickbooks tables, add them here:
-- ALTER TABLE quickbooks_invoices DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE quickbooks_customers DISABLE ROW LEVEL SECURITY;
-- etc.

-- ==========================================
-- OPTION 2: Create permissive policies (if you want to keep RLS enabled)
-- Run this INSTEAD of OPTION 1 if you want granular control
-- ==========================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow BDI users to read connections" ON quickbooks_connections;
DROP POLICY IF EXISTS "Allow BDI users to read accounts" ON quickbooks_accounts;
DROP POLICY IF EXISTS "Allow BDI users to read terms" ON quickbooks_terms;
DROP POLICY IF EXISTS "Allow BDI users to read classes" ON quickbooks_classes;

-- Create new permissive read policies for all authenticated users
CREATE POLICY "Allow all authenticated users to read connections"
ON quickbooks_connections FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow all authenticated users to read accounts"
ON quickbooks_accounts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow all authenticated users to read terms"
ON quickbooks_terms FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow all authenticated users to read classes"
ON quickbooks_classes FOR SELECT
TO authenticated
USING (true);

-- ==========================================
-- Verify policies are working
-- ==========================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as operation,
    qual as using_expression
FROM pg_policies 
WHERE tablename LIKE 'quickbooks%'
ORDER BY tablename, policyname;
