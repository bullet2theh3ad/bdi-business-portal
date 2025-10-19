-- Add other_fees_and_advertising column to sku_financial_scenarios table
-- This allows users to add dynamic line items for fees and advertising costs

ALTER TABLE public.sku_financial_scenarios
ADD COLUMN IF NOT EXISTS other_fees_and_advertising JSONB DEFAULT '[]'::jsonb;

-- Add comment to document the column
COMMENT ON COLUMN public.sku_financial_scenarios.other_fees_and_advertising IS 'Dynamic array of additional fees and advertising costs: [{ label: string, value: number }]';

