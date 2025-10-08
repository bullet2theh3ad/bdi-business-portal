-- Add PROJECT and SKU tracking to NRE Budgets

-- Add project_name to nre_budgets table (top-level project association)
ALTER TABLE nre_budgets
ADD COLUMN IF NOT EXISTS project_name TEXT;

-- Add sku_code to nre_budgets (one SKU per NRE Budget, selected at top of form)
ALTER TABLE nre_budgets
ADD COLUMN IF NOT EXISTS sku_code TEXT;

-- Add sku_name to nre_budgets for display
ALTER TABLE nre_budgets
ADD COLUMN IF NOT EXISTS sku_name TEXT;

-- Create index for faster project-based and SKU-based queries
CREATE INDEX IF NOT EXISTS idx_nre_budgets_project_name ON nre_budgets(project_name);
CREATE INDEX IF NOT EXISTS idx_nre_budgets_sku_code ON nre_budgets(sku_code);

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'nre_budgets' 
  AND column_name IN ('project_name', 'sku_code', 'sku_name')
ORDER BY ordinal_position;
