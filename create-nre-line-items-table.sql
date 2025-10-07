-- Create NRE Line Items table for tracking vendor quotes and engineering costs
-- All data processed locally - no external APIs for privacy

CREATE TABLE IF NOT EXISTS nre_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Document reference
  document_id UUID REFERENCES rag_documents(id) ON DELETE CASCADE,
  document_path TEXT, -- Path to source document in storage
  
  -- Vendor information
  vendor_name TEXT,
  vendor_contact TEXT,
  quote_number TEXT,
  quote_date DATE,
  
  -- Line item details
  line_item_number INTEGER,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- NRE Design, Tooling, EVT/DVT/PVT, etc.
  
  -- Financial details
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(12, 2),
  total_amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- Payment terms
  payment_terms TEXT, -- NET30, NET60, 50% upfront, etc.
  due_date DATE,
  
  -- Status tracking
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, paid
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  extracted_data JSONB, -- Raw extracted text and metadata
  confidence_score DECIMAL(3, 2), -- OCR confidence if applicable
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create indexes for common queries
CREATE INDEX idx_nre_line_items_document ON nre_line_items(document_id);
CREATE INDEX idx_nre_line_items_category ON nre_line_items(category);
CREATE INDEX idx_nre_line_items_status ON nre_line_items(status);
CREATE INDEX idx_nre_line_items_vendor ON nre_line_items(vendor_name);
CREATE INDEX idx_nre_line_items_due_date ON nre_line_items(due_date);
CREATE INDEX idx_nre_line_items_created_at ON nre_line_items(created_at);

-- Create view for reporting
CREATE OR REPLACE VIEW nre_line_items_summary AS
SELECT 
  category,
  COUNT(*) as item_count,
  SUM(total_amount) as total_amount,
  AVG(total_amount) as avg_amount,
  MIN(due_date) as earliest_due_date,
  MAX(due_date) as latest_due_date,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
  COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
  SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END) as pending_amount,
  SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END) as approved_amount,
  SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount
FROM nre_line_items
WHERE deleted_at IS NULL
GROUP BY category
ORDER BY total_amount DESC;

-- Create NRE categories lookup table
CREATE TABLE IF NOT EXISTS nre_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  keywords TEXT[], -- Keywords for auto-categorization
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert predefined NRE categories
INSERT INTO nre_categories (code, name, description, keywords, sort_order) VALUES
('NRE_DESIGN', 'NRE Design', 'Electrical + mechanical design hours', ARRAY['design', 'electrical', 'mechanical', 'engineering hours', 'schematic', 'pcb', 'layout'], 1),
('TOOLING', 'Tooling', 'Mold fabrication, test jigs, rework', ARRAY['tooling', 'mold', 'jig', 'fixture', 'rework', 'fabrication'], 2),
('EVT_DVT_PVT', 'EVT/DVT/PVT', 'Engineering, design, production validation builds', ARRAY['evt', 'dvt', 'pvt', 'validation', 'prototype', 'build'], 3),
('CERTIFICATIONS', 'Certifications', 'FCC/UL/CE/RoHS testing', ARRAY['certification', 'fcc', 'ul', 'ce', 'rohs', 'testing', 'compliance'], 4),
('FIELD_TESTING', 'Field Testing', 'Pilot field trials and data logs', ARRAY['field test', 'pilot', 'trial', 'beta', 'field trial'], 5),
('ODM_SETUP', 'ODM Setup', 'One-time factory engineering or system setup', ARRAY['odm', 'setup', 'factory', 'line setup', 'production setup'], 6),
('FIRMWARE', 'Firmware', 'Software dev + OTA integration', ARRAY['firmware', 'software', 'ota', 'development', 'programming'], 7),
('LOGISTICS_SAMPLES', 'Logistics Samples', 'Shipments of early builds, not CPFR inventory', ARRAY['logistics', 'sample', 'shipment', 'shipping', 'prototype shipment'], 8),
('WARRANTY_RELIABILITY', 'Warranty / Reliability', 'HALT, burn-in, reliability testing', ARRAY['warranty', 'reliability', 'halt', 'burn-in', 'stress test'], 9),
('OTHERS', 'Others', 'Custom engineering costs, BOM validation', ARRAY['other', 'custom', 'bom', 'validation', 'miscellaneous'], 10)
ON CONFLICT (code) DO NOTHING;

-- RLS Policies for nre_line_items
ALTER TABLE nre_line_items ENABLE ROW LEVEL SECURITY;

-- Super admins and CFOs can see all NRE line items
CREATE POLICY "Super admins and CFOs can view all NRE line items"
  ON nre_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('super_admin', 'admin_cfo')
      AND users.is_active = true
    )
  );

-- Super admins and CFOs can insert NRE line items
CREATE POLICY "Super admins and CFOs can insert NRE line items"
  ON nre_line_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('super_admin', 'admin_cfo')
      AND users.is_active = true
    )
  );

-- Super admins and CFOs can update NRE line items
CREATE POLICY "Super admins and CFOs can update NRE line items"
  ON nre_line_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('super_admin', 'admin_cfo')
      AND users.is_active = true
    )
  );

-- RLS for nre_categories (read-only for authenticated users)
ALTER TABLE nre_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view NRE categories"
  ON nre_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON nre_line_items TO authenticated;
GRANT SELECT ON nre_categories TO authenticated;
GRANT SELECT ON nre_line_items_summary TO authenticated;

COMMENT ON TABLE nre_line_items IS 'Tracks NRE (Non-Recurring Engineering) line items from vendor quotes - all processing done locally for privacy';
COMMENT ON TABLE nre_categories IS 'Predefined categories for NRE line items with keywords for auto-categorization';
COMMENT ON VIEW nre_line_items_summary IS 'Summary view of NRE line items grouped by category with financial totals';
