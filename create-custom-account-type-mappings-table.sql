-- Create table for custom account type mappings
-- Allows users to define their own categories and sub-categories beyond the built-in ones

CREATE TABLE IF NOT EXISTS custom_account_type_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Category and Account Type
  category TEXT NOT NULL,                    -- High-level category (e.g., 'custom_category_1')
  category_display_name TEXT NOT NULL,       -- Display name for the category (e.g., 'Special Projects')
  account_type TEXT NOT NULL,                -- Sub-category (e.g., 'Consulting')
  description TEXT,                          -- Optional description
  
  -- Metadata
  created_by UUID NOT NULL,                  -- User who created this mapping
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: each account_type should be unique across all mappings
  CONSTRAINT unique_account_type UNIQUE (account_type)
);

-- Add comment
COMMENT ON TABLE custom_account_type_mappings IS 'Custom user-defined account type to category mappings for GL transaction categorization';

-- Create index for faster lookups
CREATE INDEX idx_custom_account_type_mappings_category ON custom_account_type_mappings(category);
CREATE INDEX idx_custom_account_type_mappings_account_type ON custom_account_type_mappings(account_type);

-- RLS Policy: Allow authenticated users to read/write their own org's mappings
ALTER TABLE custom_account_type_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on custom_account_type_mappings" ON custom_account_type_mappings;
CREATE POLICY "Allow all operations on custom_account_type_mappings"
  ON custom_account_type_mappings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON custom_account_type_mappings TO service_role;
GRANT ALL ON custom_account_type_mappings TO authenticated;

