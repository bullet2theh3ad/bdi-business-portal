-- ============================================================================
-- ASYMMETRIC ORGANIZATION CONNECTIONS SCHEMA
-- This replaces the simple bilateral connection with sophisticated directional control
-- ============================================================================

-- Step 1: Create data classification enum
CREATE TYPE data_category AS ENUM (
  'public',        -- Company info, contact details
  'partner',       -- Inventory levels, shipping schedules  
  'confidential',  -- Financial data, contracts
  'internal'       -- Strategic plans, employee data
);

-- Step 2: Drop existing organization_connections table and recreate with asymmetric model
DROP TABLE IF EXISTS organization_connections CASCADE;

-- Step 3: Create new asymmetric connections table
-- Each connection is now DIRECTIONAL (A → B is separate from B → A)
CREATE TABLE organization_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source and target organizations (directional)
  source_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  target_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Connection metadata
  connection_type VARCHAR(50) NOT NULL DEFAULT 'messaging', -- 'messaging', 'file_share', 'full_collaboration'
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'pending', 'suspended'
  
  -- Granular permissions - what SOURCE can see/do with TARGET's data
  permissions JSONB NOT NULL DEFAULT '{
    "canViewPublicData": true,
    "canViewPartnerData": false,
    "canViewConfidentialData": false,
    "canViewInternalData": false,
    "canViewUsers": false,
    "canViewTeams": false,
    "canCreateCrossOrgTeams": false,
    "canChat": false,
    "canViewFiles": false,
    "canShareFiles": false,
    "canDownloadFiles": false,
    "canUploadFiles": false
  }',
  
  -- Data category access control
  allowed_data_categories data_category[] DEFAULT ARRAY['public']::data_category[],
  
  -- Connection purpose and metadata
  description TEXT,
  tags VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR[], -- e.g., ['supply-chain', 'logistics']
  
  -- Audit trail
  created_by UUID NOT NULL REFERENCES users(auth_id) ON DELETE CASCADE, -- BDI Super Admin
  approved_by UUID REFERENCES users(auth_id), -- Optional approval workflow
  
  -- Time constraints
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE, -- Optional expiration
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT no_self_connection CHECK (source_organization_id != target_organization_id),
  CONSTRAINT unique_directional_connection UNIQUE (source_organization_id, target_organization_id)
);

-- Step 4: Create indexes for performance
CREATE INDEX idx_org_connections_source ON organization_connections(source_organization_id);
CREATE INDEX idx_org_connections_target ON organization_connections(target_organization_id);
CREATE INDEX idx_org_connections_status ON organization_connections(status);
CREATE INDEX idx_org_connections_type ON organization_connections(connection_type);
CREATE INDEX idx_org_connections_tags ON organization_connections USING GIN(tags);
CREATE INDEX idx_org_connections_data_categories ON organization_connections USING GIN(allowed_data_categories);

-- Step 5: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organization_connections_updated_at
    BEFORE UPDATE ON organization_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Insert sample asymmetric connections for testing
-- BDI → TC1 (BDI can see TC1's partner data)
INSERT INTO organization_connections (
  source_organization_id,
  target_organization_id,
  connection_type,
  permissions,
  allowed_data_categories,
  description,
  tags,
  created_by
) VALUES (
  (SELECT id FROM organizations WHERE code = 'BDI'),
  (SELECT id FROM organizations WHERE code = 'TC1'),
  'file_share',
  '{
    "canViewPublicData": true,
    "canViewPartnerData": true,
    "canViewConfidentialData": true,
    "canViewInternalData": false,
    "canViewUsers": true,
    "canViewTeams": true,
    "canCreateCrossOrgTeams": true,
    "canChat": true,
    "canViewFiles": true,
    "canShareFiles": true,
    "canDownloadFiles": true,
    "canUploadFiles": false
  }',
  ARRAY['public', 'partner', 'confidential']::data_category[],
  'BDI has full visibility into TC1 operations for supply chain management',
  ARRAY['supply-chain', 'logistics', 'primary-partner'],
  (SELECT auth_id FROM users WHERE email = 'steve@spnnet.com')
) ON CONFLICT (source_organization_id, target_organization_id) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  allowed_data_categories = EXCLUDED.allowed_data_categories,
  updated_at = NOW();

-- TC1 → BDI (TC1 has limited access to BDI's public data only)
INSERT INTO organization_connections (
  source_organization_id,
  target_organization_id,
  connection_type,
  permissions,
  allowed_data_categories,
  description,
  tags,
  created_by
) VALUES (
  (SELECT id FROM organizations WHERE code = 'TC1'),
  (SELECT id FROM organizations WHERE code = 'BDI'),
  'messaging',
  '{
    "canViewPublicData": true,
    "canViewPartnerData": false,
    "canViewConfidentialData": false,
    "canViewInternalData": false,
    "canViewUsers": true,
    "canViewTeams": false,
    "canCreateCrossOrgTeams": false,
    "canChat": true,
    "canViewFiles": false,
    "canShareFiles": false,
    "canDownloadFiles": false,
    "canUploadFiles": false
  }',
  ARRAY['public']::data_category[],
  'TC1 has limited messaging access to BDI public information',
  ARRAY['supply-chain', 'logistics'],
  (SELECT auth_id FROM users WHERE email = 'steve@spnnet.com')
) ON CONFLICT (source_organization_id, target_organization_id) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  allowed_data_categories = EXCLUDED.allowed_data_categories,
  updated_at = NOW();

-- Step 7: Create helper views for easier querying
CREATE OR REPLACE VIEW v_organization_connections_detailed AS
SELECT 
  oc.id,
  oc.source_organization_id,
  source_org.name as source_organization_name,
  source_org.code as source_organization_code,
  oc.target_organization_id,
  target_org.name as target_organization_name,
  target_org.code as target_organization_code,
  oc.connection_type,
  oc.status,
  oc.permissions,
  oc.allowed_data_categories,
  oc.description,
  oc.tags,
  oc.start_date,
  oc.end_date,
  creator.email as created_by_email,
  oc.created_at,
  oc.updated_at
FROM organization_connections oc
JOIN organizations source_org ON oc.source_organization_id = source_org.id
JOIN organizations target_org ON oc.target_organization_id = target_org.id
JOIN users creator ON oc.created_by = creator.auth_id;

-- Step 8: Create function to get bilateral connection status
CREATE OR REPLACE FUNCTION get_bilateral_connection_status(org_a_id UUID, org_b_id UUID)
RETURNS TABLE (
  a_to_b_exists BOOLEAN,
  a_to_b_type VARCHAR(50),
  a_to_b_permissions JSONB,
  b_to_a_exists BOOLEAN,
  b_to_a_type VARCHAR(50),
  b_to_a_permissions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (a_to_b.id IS NOT NULL) as a_to_b_exists,
    a_to_b.connection_type as a_to_b_type,
    a_to_b.permissions as a_to_b_permissions,
    (b_to_a.id IS NOT NULL) as b_to_a_exists,
    b_to_a.connection_type as b_to_a_type,
    b_to_a.permissions as b_to_a_permissions
  FROM 
    (SELECT 1) as dummy
  LEFT JOIN organization_connections a_to_b ON 
    a_to_b.source_organization_id = org_a_id AND 
    a_to_b.target_organization_id = org_b_id AND
    a_to_b.status = 'active'
  LEFT JOIN organization_connections b_to_a ON 
    b_to_a.source_organization_id = org_b_id AND 
    b_to_a.target_organization_id = org_a_id AND
    b_to_a.status = 'active';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE organization_connections IS 'Asymmetric directional connections between organizations with granular permission control';
COMMENT ON FUNCTION get_bilateral_connection_status IS 'Helper function to check bilateral connection status between two organizations';

-- Verification queries
SELECT 'Schema created successfully. Sample connections:' as status;
SELECT * FROM v_organization_connections_detailed;
