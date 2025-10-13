-- =====================================================
-- Secure QuickBooks RLS with Authorization Table
-- Only specific users in the auth list can access QB data
-- Manage access by adding/removing records in the table
-- =====================================================

-- Create authorization table for QuickBooks access
CREATE TABLE IF NOT EXISTS quickbooks_authorized_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT -- Optional: why this user has access
);

-- Enable RLS on the authorization table itself
ALTER TABLE quickbooks_authorized_users ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage the authorization list
CREATE POLICY "Super admins can manage QB authorized users"
    ON quickbooks_authorized_users FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Drop existing QB policies
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

-- Create new policies - only authorized users can access
CREATE POLICY "Authorized users can access QB connections"
    ON quickbooks_connections FOR ALL
    USING (
        auth.uid() IN (SELECT auth_id FROM quickbooks_authorized_users)
    );

CREATE POLICY "Authorized users can access QB sync logs"
    ON quickbooks_sync_log FOR ALL
    USING (
        auth.uid() IN (SELECT auth_id FROM quickbooks_authorized_users)
    );

CREATE POLICY "Authorized users can access QB customers"
    ON quickbooks_customers FOR ALL
    USING (
        auth.uid() IN (SELECT auth_id FROM quickbooks_authorized_users)
    );

CREATE POLICY "Authorized users can access QB invoices"
    ON quickbooks_invoices FOR ALL
    USING (
        auth.uid() IN (SELECT auth_id FROM quickbooks_authorized_users)
    );

CREATE POLICY "Authorized users can access QB vendors"
    ON quickbooks_vendors FOR ALL
    USING (
        auth.uid() IN (SELECT auth_id FROM quickbooks_authorized_users)
    );

CREATE POLICY "Authorized users can access QB expenses"
    ON quickbooks_expenses FOR ALL
    USING (
        auth.uid() IN (SELECT auth_id FROM quickbooks_authorized_users)
    );

-- Add Steve as the first authorized user
-- Replace this with your actual auth.users UUID
INSERT INTO quickbooks_authorized_users (auth_id, user_email, notes)
SELECT 
    id,
    email,
    'Initial QB access - Project owner'
FROM auth.users
WHERE email = 'scistulli@boundlessdevices.com'
ON CONFLICT (auth_id) DO NOTHING;

-- Success message
SELECT 'QuickBooks authorization table created and RLS policies updated!' as status;
SELECT 'Steve has been granted access. Add others with:' as instructions;
SELECT 'INSERT INTO quickbooks_authorized_users (auth_id, user_email, notes) 
SELECT id, email, ''Finance team access'' FROM auth.users WHERE email = ''name@example.com'';' as example;

