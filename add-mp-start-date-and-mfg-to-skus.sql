-- Add MP Start Date and MFG fields to product_skus table
-- Run this SQL in your PostgreSQL database

-- Add the new columns to the product_skus table
ALTER TABLE product_skus 
ADD COLUMN mp_start_date TIMESTAMP,
ADD COLUMN mfg VARCHAR(100);

-- Add comments for documentation
COMMENT ON COLUMN product_skus.mp_start_date IS 'Manufacturing Program start date - when production begins';
COMMENT ON COLUMN product_skus.mfg IS 'Manufacturer code/name - for organization-based access control (MOT, HYT, KEN, etc.)';

-- Optional: Set default values for existing SKUs if needed
-- UPDATE product_skus SET mfg = 'UNKNOWN' WHERE mfg IS NULL;

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'product_skus' 
AND column_name IN ('mp_start_date', 'mfg')
ORDER BY column_name;
