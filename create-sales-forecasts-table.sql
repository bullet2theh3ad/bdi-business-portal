-- Create sales_forecasts table for CPFR system
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS sales_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES invoices(id) ON DELETE SET NULL, -- Link to PO if part of existing order
  
  -- Forecast Details
  delivery_week VARCHAR(20) NOT NULL, -- ISO week format: 2025-W12 or date
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  confidence VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high
  shipping_preference VARCHAR(100), -- AIR_EXPRESS, SEA_STANDARD, etc.
  
  -- Forecast Type/Status
  forecast_type VARCHAR(50) NOT NULL DEFAULT 'planning', -- part_of_po, pre_po, planning
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, submitted, approved, committed
  
  -- Additional Info
  notes TEXT,
  moq_override BOOLEAN DEFAULT false,
  custom_lead_time INTEGER, -- Custom lead time in days if specified
  
  -- Audit Fields
  created_by UUID NOT NULL REFERENCES users(auth_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_sales_forecasts_sku_id ON sales_forecasts(sku_id);
CREATE INDEX idx_sales_forecasts_delivery_week ON sales_forecasts(delivery_week);
CREATE INDEX idx_sales_forecasts_created_by ON sales_forecasts(created_by);
CREATE INDEX idx_sales_forecasts_status ON sales_forecasts(status);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_forecasts TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verify table was created
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'sales_forecasts'
ORDER BY ordinal_position;
