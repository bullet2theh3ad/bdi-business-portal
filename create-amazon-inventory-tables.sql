-- Amazon Inventory Import Tracking Table
CREATE TABLE IF NOT EXISTS amazon_inventory_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
  total_skus INTEGER DEFAULT 0,
  total_units INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Amazon Inventory Units Table
CREATE TABLE IF NOT EXISTS amazon_inventory_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id UUID NOT NULL REFERENCES amazon_inventory_imports(id) ON DELETE CASCADE,
  
  -- Amazon identifiers
  sku TEXT NOT NULL, -- Amazon Seller SKU
  asin TEXT,
  fnsku TEXT,
  condition TEXT,
  
  -- Quantity
  afn_total_quantity INTEGER DEFAULT 0,
  afn_fulfillable_quantity INTEGER DEFAULT 0,
  afn_unsellable_quantity INTEGER DEFAULT 0,
  afn_reserved_quantity INTEGER DEFAULT 0,
  afn_inbound_quantity INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Index for fast lookups
  CONSTRAINT amazon_inventory_units_unique UNIQUE (import_batch_id, sku, asin)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_amazon_inventory_imports_status ON amazon_inventory_imports(status);
CREATE INDEX IF NOT EXISTS idx_amazon_inventory_imports_completed_at ON amazon_inventory_imports(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_amazon_inventory_units_import_batch ON amazon_inventory_units(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_amazon_inventory_units_sku ON amazon_inventory_units(sku);
CREATE INDEX IF NOT EXISTS idx_amazon_inventory_units_asin ON amazon_inventory_units(asin);

-- RLS Policies (allow authenticated users to read, only super_admin to write)
ALTER TABLE amazon_inventory_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE amazon_inventory_units ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Allow authenticated users to read amazon_inventory_imports"
  ON amazon_inventory_imports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read amazon_inventory_units"
  ON amazon_inventory_units FOR SELECT
  TO authenticated
  USING (true);

-- Allow super_admin to insert/update/delete
CREATE POLICY "Allow super_admin to manage amazon_inventory_imports"
  ON amazon_inventory_imports FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Allow super_admin to manage amazon_inventory_units"
  ON amazon_inventory_units FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

COMMENT ON TABLE amazon_inventory_imports IS 'Tracks Amazon FBA inventory CSV imports';
COMMENT ON TABLE amazon_inventory_units IS 'Stores Amazon FBA inventory unit data from CSV uploads';

