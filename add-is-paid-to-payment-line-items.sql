-- Add isPaid field to nre_budget_payment_line_items table

-- Add the is_paid column
ALTER TABLE nre_budget_payment_line_items
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN nre_budget_payment_line_items.is_paid IS 'Indicates whether the payment has been made';

-- Update existing records to false (not paid) by default
UPDATE nre_budget_payment_line_items
SET is_paid = FALSE
WHERE is_paid IS NULL;

-- Verify the change
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'nre_budget_payment_line_items'
AND column_name = 'is_paid';

