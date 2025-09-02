-- Add HTS Code field to product_skus table
-- Run this in Supabase SQL Editor

-- Add HTS Code column to existing product_skus table
ALTER TABLE product_skus 
ADD COLUMN hts_code VARCHAR(12); -- Allows for NNNN.NN.NNNN format (10 digits + 2 dots)

-- Add comment for documentation
COMMENT ON COLUMN product_skus.hts_code IS 'Harmonized Tariff Schedule code for customs/trade classification (format: NNNN.NN.NNNN)';

-- Create index for HTS code lookups (useful for trade reporting)
CREATE INDEX idx_product_skus_hts_code ON product_skus(hts_code) WHERE hts_code IS NOT NULL;

-- Grant permissions (if needed)
GRANT SELECT, INSERT, UPDATE ON product_skus TO authenticated;

-- Verify the column was added
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'product_skus' AND column_name = 'hts_code';

-- Optional: Add some example data to test
-- UPDATE product_skus 
-- SET hts_code = '8517.62.0050' 
-- WHERE sku = 'MNQ1525-30W-U'; -- Example: Communication device

-- Show updated table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'product_skus'
ORDER BY ordinal_position;
