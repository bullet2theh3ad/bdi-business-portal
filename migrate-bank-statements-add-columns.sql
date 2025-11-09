-- =========================================================================
-- Migration: Add missing columns to bank_statements table
-- =========================================================================

-- Add amount column (net credit - debit)
ALTER TABLE bank_statements 
ADD COLUMN IF NOT EXISTS amount DECIMAL(15, 2);

-- Add reference_number column (combines check_number, bank_reference, customer_reference)
ALTER TABLE bank_statements 
ADD COLUMN IF NOT EXISTS reference_number TEXT;

-- Add bank_account_name column
ALTER TABLE bank_statements 
ADD COLUMN IF NOT EXISTS bank_account_name TEXT;

-- Add original_line column for debugging
ALTER TABLE bank_statements 
ADD COLUMN IF NOT EXISTS original_line TEXT;

-- Add created_by column (stores Supabase auth user ID, not DB user table ID)
ALTER TABLE bank_statements 
ADD COLUMN IF NOT EXISTS created_by UUID;

-- Make uploaded_by nullable (API uses created_by instead)
ALTER TABLE bank_statements 
ALTER COLUMN uploaded_by DROP NOT NULL;

-- Copy uploaded_by to created_by for existing rows
UPDATE bank_statements 
SET created_by = uploaded_by
WHERE created_by IS NULL AND uploaded_by IS NOT NULL;

-- Update existing rows to have amount calculated from debit/credit
UPDATE bank_statements 
SET amount = COALESCE(credit, 0) - COALESCE(debit, 0)
WHERE amount IS NULL;

-- Add index on amount for performance
CREATE INDEX IF NOT EXISTS idx_bank_statements_amount_value 
  ON bank_statements(amount) WHERE amount IS NOT NULL;

-- Add comments
COMMENT ON COLUMN bank_statements.amount IS 'Net amount: credit - debit (positive = money in, negative = money out)';
COMMENT ON COLUMN bank_statements.reference_number IS 'Combined reference: check number, bank reference, or customer reference';
COMMENT ON COLUMN bank_statements.bank_account_name IS 'Name of the bank account from the statement';
COMMENT ON COLUMN bank_statements.original_line IS 'Original CSV/Excel row data for debugging';
COMMENT ON COLUMN bank_statements.created_by IS 'Supabase auth user ID who uploaded this transaction (not FK to users table)';

