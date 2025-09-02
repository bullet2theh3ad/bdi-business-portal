-- Create warehouses table for shipping and logistics management
CREATE TABLE warehouses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('warehouse', 'distribution_center', 'fulfillment_center', 'cross_dock', 'manufacturing')),
  
  -- Location Information
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  country VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20),
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Shipping Capabilities (JSONB for flexibility)
  capabilities JSONB NOT NULL DEFAULT '{
    "airFreight": false,
    "seaFreight": false,
    "truckLoading": false,
    "railAccess": false,
    "coldStorage": false,
    "hazmatHandling": false
  }',
  
  -- Operational Details
  operating_hours VARCHAR(100),
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  
  -- Physical Specifications (for shipping calculations)
  max_pallet_height_cm INTEGER DEFAULT 180,
  max_pallet_weight_kg INTEGER DEFAULT 1000,
  loading_dock_count INTEGER DEFAULT 1,
  storage_capacity_sqm INTEGER DEFAULT 1000,
  
  -- Status and Metadata
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(auth_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  organization_id UUID REFERENCES organizations(id)
);

-- Create indexes for performance
CREATE INDEX idx_warehouses_code ON warehouses(warehouse_code);
CREATE INDEX idx_warehouses_type ON warehouses(type);
CREATE INDEX idx_warehouses_city ON warehouses(city);
CREATE INDEX idx_warehouses_organization_id ON warehouses(organization_id);
CREATE INDEX idx_warehouses_created_at ON warehouses(created_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

-- Warehouses RLS Policies
CREATE POLICY "Users can view warehouses from their organization" ON warehouses
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert warehouses for their organization" ON warehouses
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can update warehouses from their organization" ON warehouses
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete warehouses from their organization" ON warehouses
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
