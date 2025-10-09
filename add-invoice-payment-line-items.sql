-- Add payment line items table for Invoices
-- Track payment schedule, status, and dates for vendor invoices
-- Mirrors the NRE Budget payment tracking functionality

-- Create invoice_payment_line_items table
CREATE TABLE IF NOT EXISTS invoice_payment_line_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_number INTEGER NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  notes TEXT,
  is_paid BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES users(auth_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invoice_payment_items_invoice_id ON invoice_payment_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_items_payment_date ON invoice_payment_line_items(payment_date);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_items_is_paid ON invoice_payment_line_items(is_paid);

-- Add RLS policies for invoice_payment_line_items
ALTER TABLE invoice_payment_line_items ENABLE ROW LEVEL SECURITY;

-- Policy: BDI users (super_admin, admin_cfo) can manage all invoice payment items
CREATE POLICY "BDI users can manage invoice payment items"
ON invoice_payment_line_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
    INNER JOIN organizations o ON om.organization_uuid = o.id
    WHERE u.auth_id = auth.uid()
    AND o.code = 'BDI'
    AND (u.role IN ('super_admin') OR om.role IN ('admin_cfo', 'admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    INNER JOIN organization_members om ON u.auth_id = om.user_auth_id
    INNER JOIN organizations o ON om.organization_uuid = o.id
    WHERE u.auth_id = auth.uid()
    AND o.code = 'BDI'
    AND (u.role IN ('super_admin') OR om.role IN ('admin_cfo', 'admin'))
  )
);

-- Verify the table and policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM pg_policies
WHERE tablename = 'invoice_payment_line_items'
ORDER BY policyname;

-- Sample query to check structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'invoice_payment_line_items'
ORDER BY ordinal_position;

