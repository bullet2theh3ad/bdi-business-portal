-- =====================================================
-- SKU Mappings Table
-- Maps external channel SKUs/ASINs to internal product SKUs
-- =====================================================

-- Create SKU mappings table
CREATE TABLE IF NOT EXISTS sku_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign key to product_skus table
  internal_sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  
  -- External identifier (could be Amazon ASIN, seller SKU, UPC, etc.)
  external_identifier TEXT NOT NULL,
  
  -- Channel/source of this identifier
  channel TEXT NOT NULL, -- e.g., 'amazon_asin', 'amazon_seller_sku', 'walmart', 'ebay', 'upc', 'ean'
  
  -- Optional notes/description for this mapping
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(auth_id) ON DELETE SET NULL,
  
  -- Prevent duplicate mappings
  UNIQUE(external_identifier, channel)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sku_mappings_internal_sku ON sku_mappings(internal_sku_id);
CREATE INDEX IF NOT EXISTS idx_sku_mappings_external ON sku_mappings(external_identifier);
CREATE INDEX IF NOT EXISTS idx_sku_mappings_channel ON sku_mappings(channel);
CREATE INDEX IF NOT EXISTS idx_sku_mappings_lookup ON sku_mappings(external_identifier, channel);

-- Enable RLS
ALTER TABLE sku_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can view mappings
DROP POLICY IF EXISTS sku_mappings_select_policy ON sku_mappings;
CREATE POLICY sku_mappings_select_policy ON sku_mappings
  FOR SELECT
  TO authenticated
  USING (true); -- All authenticated users can see mappings

-- Only admins and super_admins can insert/update/delete
DROP POLICY IF EXISTS sku_mappings_modify_policy ON sku_mappings;
CREATE POLICY sku_mappings_modify_policy ON sku_mappings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Service role can do everything
DROP POLICY IF EXISTS sku_mappings_service_policy ON sku_mappings;
CREATE POLICY sku_mappings_service_policy ON sku_mappings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Helper view: SKU with all mappings
CREATE OR REPLACE VIEW sku_with_mappings AS
SELECT 
  ps.id,
  ps.sku as internal_sku,
  ps.name,
  ps.mfg,
  json_agg(
    json_build_object(
      'id', sm.id,
      'external_identifier', sm.external_identifier,
      'channel', sm.channel,
      'notes', sm.notes,
      'created_at', sm.created_at
    ) ORDER BY sm.created_at
  ) FILTER (WHERE sm.id IS NOT NULL) as mappings
FROM product_skus ps
LEFT JOIN sku_mappings sm ON ps.id = sm.internal_sku_id
GROUP BY ps.id, ps.sku, ps.name, ps.mfg;

-- Helper function: Find internal SKU by external identifier
CREATE OR REPLACE FUNCTION find_internal_sku(
  p_external_identifier TEXT,
  p_channel TEXT DEFAULT NULL
) RETURNS TABLE(
  internal_sku_id UUID,
  internal_sku TEXT,
  sku_name TEXT,
  manufacturer TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.id,
    ps.sku,
    ps.name,
    ps.mfg
  FROM sku_mappings sm
  JOIN product_skus ps ON sm.internal_sku_id = ps.id
  WHERE sm.external_identifier = p_external_identifier
    AND (p_channel IS NULL OR sm.channel = p_channel)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Usage examples:
-- 
-- Add a mapping:
-- INSERT INTO sku_mappings (internal_sku_id, external_identifier, channel, notes, created_by)
-- VALUES (
--   (SELECT id FROM product_skus WHERE sku = 'MG8702-10'),
--   'B08XYZ123',
--   'amazon_asin',
--   'Standard ASIN for Amazon US marketplace',
--   (SELECT auth_id FROM users WHERE email = 'scistulli@boundlessdevices.com')
-- );
--
-- Find internal SKU by Amazon ASIN:
-- SELECT * FROM find_internal_sku('B08XYZ123', 'amazon_asin');
--
-- Get all mappings for a SKU:
-- SELECT * FROM sku_mappings WHERE internal_sku_id = (SELECT id FROM product_skus WHERE sku = 'MG8702-10');
--
-- View all SKUs with their mappings:
-- SELECT * FROM sku_with_mappings WHERE internal_sku LIKE 'MG%';

COMMENT ON TABLE sku_mappings IS 'Maps external channel identifiers (ASINs, seller SKUs, UPCs) to internal product SKUs';
COMMENT ON COLUMN sku_mappings.channel IS 'Source channel: amazon_asin, amazon_seller_sku, walmart, ebay, upc, ean, etc.';
COMMENT ON COLUMN sku_mappings.external_identifier IS 'The external SKU/ASIN/UPC number from the channel';

