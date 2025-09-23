-- Add PDF storage field to purchase_orders table
-- This allows storing the PDF file path for generated purchase order PDFs

ALTER TABLE purchase_orders 
ADD COLUMN pdf_url TEXT;

-- Add comment to document the field
COMMENT ON COLUMN purchase_orders.pdf_url IS 'File path to the generated PDF in Supabase storage (organization-documents bucket)';

-- Verify the addition
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'purchase_orders' 
  AND column_name = 'pdf_url';
