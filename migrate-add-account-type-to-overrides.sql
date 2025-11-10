-- Migration: Add override_account_type column to gl_transaction_overrides table
-- This allows storing the detailed account type (e.g., "Contract", "Services", "Finished Goods") 
-- alongside the high-level category (e.g., "opex", "inventory") for granular categorization

-- Add the override_account_type column
ALTER TABLE gl_transaction_overrides
ADD COLUMN IF NOT EXISTS override_account_type TEXT;

-- Add a comment to document the column's purpose
COMMENT ON COLUMN gl_transaction_overrides.override_account_type IS 'User-assigned detailed account type (e.g., Contract, Services, Finished Goods) for granular categorization.';

-- Query to verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'gl_transaction_overrides' 
  AND column_name = 'override_account_type';

