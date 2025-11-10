-- Backfill override_account_type for existing gl_transaction_overrides
-- This sets sensible default account types based on the high-level category
-- for all overrides that were created before the override_account_type column existed

-- Update NRE overrides to default to "R&D Services"
UPDATE gl_transaction_overrides
SET override_account_type = 'R&D Services'
WHERE override_category = 'nre'
  AND override_account_type IS NULL;

-- Update Inventory overrides to default to "Finished Goods"
UPDATE gl_transaction_overrides
SET override_account_type = 'Finished Goods'
WHERE override_category = 'inventory'
  AND override_account_type IS NULL;

-- Update OpEx overrides to default to "Services"
UPDATE gl_transaction_overrides
SET override_account_type = 'Services'
WHERE override_category = 'opex'
  AND override_account_type IS NULL;

-- Update Marketing overrides to default to "Marketing Services"
UPDATE gl_transaction_overrides
SET override_account_type = 'Marketing Services'
WHERE override_category = 'marketing'
  AND override_account_type IS NULL;

-- Update Labor overrides to default to "Payroll"
UPDATE gl_transaction_overrides
SET override_account_type = 'Payroll'
WHERE override_category = 'labor'
  AND override_account_type IS NULL;

-- Update Loans overrides to default to "Line of Credit Draw"
UPDATE gl_transaction_overrides
SET override_account_type = 'Line of Credit Draw'
WHERE override_category = 'loans'
  AND override_account_type IS NULL;

-- Update Loan Interest overrides to default to "Loan Interest"
UPDATE gl_transaction_overrides
SET override_account_type = 'Loan Interest'
WHERE override_category = 'loan_interest'
  AND override_account_type IS NULL;

-- Update Revenue overrides to default to "B2B Sales"
UPDATE gl_transaction_overrides
SET override_account_type = 'B2B Sales'
WHERE override_category = 'revenue'
  AND override_account_type IS NULL;

-- Update Investments overrides to default to "Equity Investment"
UPDATE gl_transaction_overrides
SET override_account_type = 'Equity Investment'
WHERE override_category = 'investments'
  AND override_account_type IS NULL;

-- Update Other overrides to default to "Miscellaneous"
UPDATE gl_transaction_overrides
SET override_account_type = 'Miscellaneous'
WHERE override_category = 'other'
  AND override_account_type IS NULL;

-- Update Unassigned overrides to "Unclassified"
UPDATE gl_transaction_overrides
SET override_account_type = 'Unclassified'
WHERE override_category = 'unassigned'
  AND override_account_type IS NULL;

-- Display summary of backfilled records
SELECT 
  override_category,
  override_account_type,
  COUNT(*) as count
FROM gl_transaction_overrides
WHERE override_account_type IS NOT NULL
GROUP BY override_category, override_account_type
ORDER BY override_category, override_account_type;

