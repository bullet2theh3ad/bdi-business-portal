-- ADD EDITABLE DESCRIPTION FIELD TO INVOICE LINE ITEMS
-- This allows manual description editing for each line item in invoices

-- Add description field to invoice_line_items table
ALTER TABLE invoice_line_items 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add comment for documentation
COMMENT ON COLUMN invoice_line_items.description IS 'Manually editable description for invoice line item';

-- Check the updated table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'invoice_line_items' 
AND table_schema = 'public'
ORDER BY ordinal_position;
