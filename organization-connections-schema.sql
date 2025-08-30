-- Organization Connections Schema
-- Run this in your Supabase SQL Editor

-- Create organization connections table
CREATE TABLE IF NOT EXISTS organization_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The organizations being connected
  organization_a_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  organization_b_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Connection metadata
  connection_type VARCHAR(50) NOT NULL DEFAULT 'messaging', -- 'messaging', 'file_share', 'full_collaboration'
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'pending', 'suspended'
  
  -- Permissions for the connection
  permissions JSONB DEFAULT '{}', -- JSON object defining what each org can access
  
  -- Who created/manages this connection
  created_by UUID NOT NULL REFERENCES users(auth_id) ON DELETE CASCADE, -- BDI Super Admin
  approved_by UUID REFERENCES users(auth_id), -- Optional approval workflow
  
  -- Connection details
  description TEXT, -- Purpose of the connection
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE, -- Optional expiration
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure no duplicate connections (bidirectional)
  CONSTRAINT unique_org_connection UNIQUE(organization_a_id, organization_b_id),
  -- Prevent self-connections
  CONSTRAINT no_self_connection CHECK (organization_a_id != organization_b_id)
);

-- Create indexes for performance
CREATE INDEX idx_org_connections_org_a ON organization_connections(organization_a_id);
CREATE INDEX idx_org_connections_org_b ON organization_connections(organization_b_id);
CREATE INDEX idx_org_connections_status ON organization_connections(status);
CREATE INDEX idx_org_connections_created_by ON organization_connections(created_by);

-- Enable RLS
ALTER TABLE organization_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- BDI Super Admins can manage all connections
CREATE POLICY "BDI Super Admins can manage all connections"
ON organization_connections
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users u 
    JOIN organization_members om ON u.auth_id = om.user_auth_id 
    JOIN organizations o ON om.organization_uuid = o.id 
    WHERE u.auth_id = auth.uid() 
    AND u.role = 'super_admin' 
    AND o.code = 'BDI' 
    AND o.type = 'internal'
  )
);

-- Organization admins can view their own connections
CREATE POLICY "Organization admins can view their connections"
ON organization_connections
FOR SELECT
USING (
  organization_a_id IN (
    SELECT o.id 
    FROM organizations o 
    JOIN organization_members om ON o.id = om.organization_uuid 
    JOIN users u ON om.user_auth_id = u.auth_id 
    WHERE u.auth_id = auth.uid() AND u.role = 'admin'
  ) OR
  organization_b_id IN (
    SELECT o.id 
    FROM organizations o 
    JOIN organization_members om ON o.id = om.organization_uuid 
    JOIN users u ON om.user_auth_id = u.auth_id 
    WHERE u.auth_id = auth.uid() AND u.role = 'admin'
  )
);

-- Create a view for easier querying of connections
CREATE OR REPLACE VIEW organization_connections_view AS
SELECT 
  oc.*,
  org_a.name as organization_a_name,
  org_a.code as organization_a_code,
  org_a.type as organization_a_type,
  org_b.name as organization_b_name,
  org_b.code as organization_b_code,
  org_b.type as organization_b_type,
  creator.name as created_by_name,
  creator.email as created_by_email
FROM organization_connections oc
JOIN organizations org_a ON oc.organization_a_id = org_a.id
JOIN organizations org_b ON oc.organization_b_id = org_b.id
JOIN users creator ON oc.created_by = creator.auth_id;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_org_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organization_connections_updated_at 
    BEFORE UPDATE ON organization_connections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_org_connections_updated_at();
