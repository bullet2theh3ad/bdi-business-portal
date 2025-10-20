-- Add Standard Cost field to product_skus table
-- This represents the standard/baseline cost for each SKU

ALTER TABLE public.product_skus
ADD COLUMN IF NOT EXISTS standard_cost NUMERIC(10, 2);

-- Add comment for documentation
COMMENT ON COLUMN public.product_skus.standard_cost IS 'Standard/baseline cost per unit in USD';

-- Create index for filtering/sorting by cost
CREATE INDEX IF NOT EXISTS idx_product_skus_standard_cost ON public.product_skus(standard_cost);

