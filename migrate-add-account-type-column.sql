-- Migration: Add account_type column to bank_statements and gl_transaction_overrides
-- This enables hierarchical categorization: Account Type → Category

-- Add account_type to bank_statements
ALTER TABLE bank_statements 
ADD COLUMN IF NOT EXISTS account_type TEXT;

COMMENT ON COLUMN bank_statements.account_type IS 'Detailed account type that rolls up to category (e.g., Contract, Services, Annual Subscription)';

-- Add account_type to gl_transaction_overrides
ALTER TABLE gl_transaction_overrides 
ADD COLUMN IF NOT EXISTS account_type TEXT;

COMMENT ON COLUMN gl_transaction_overrides.account_type IS 'Detailed account type override that rolls up to category';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_bank_statements_account_type ON bank_statements(account_type);
CREATE INDEX IF NOT EXISTS idx_gl_overrides_account_type ON gl_transaction_overrides(account_type);

-- Add a check to ensure category and account_type are consistent
-- (Optional - enforces data integrity)
COMMENT ON COLUMN bank_statements.category IS 'High-level category (opex, nre, inventory, etc.) - should match account_type mapping';
COMMENT ON COLUMN gl_transaction_overrides.override_category IS 'High-level category override - should match account_type mapping';

