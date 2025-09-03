-- Create production_files table for device manufacturing files
-- This table stores files related to production (MAC addresses, Serial Numbers, etc.)
-- Files are associated with shipments/forecasts and organized by organization

CREATE TABLE production_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- File Information
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  
  -- Association with Shipments/Forecasts
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  forecast_id UUID REFERENCES sales_forecasts(id) ON DELETE CASCADE,
  bdi_shipment_number VARCHAR(100), -- BDI-generated shipment number
  
  -- Device Information
  device_metadata JSONB NOT NULL DEFAULT '{
    "cmMacAddresses": [],
    "macAddresses": [],
    "serialNumbers": [],
    "deviceCount": 0,
    "productionBatch": null,
    "manufacturingDate": null
  }',
  
  -- File Type and Category
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN (
    'MAC_ADDRESS_LIST', 'SERIAL_NUMBER_LIST', 'PRODUCTION_REPORT', 
    'TEST_RESULTS', 'CALIBRATION_DATA', 'FIRMWARE_VERSION', 
    'QUALITY_CONTROL', 'PACKAGING_LIST', 'OTHER'
  )),
  
  -- Organization and Access Control
  organization_id UUID NOT NULL REFERENCES organizations(id),
  uploaded_by UUID NOT NULL REFERENCES users(auth_id),
  
  -- Access Control Flags
  is_public_to_bdi BOOLEAN DEFAULT false, -- If true, BDI can see this file
  allowed_organizations UUID[] DEFAULT '{}', -- Array of org IDs that can access this file
  
  -- Metadata
  description TEXT,
  tags VARCHAR(50)[],
  
  -- Audit Fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_production_files_organization_id ON production_files(organization_id);
CREATE INDEX idx_production_files_shipment_id ON production_files(shipment_id);
CREATE INDEX idx_production_files_forecast_id ON production_files(forecast_id);
CREATE INDEX idx_production_files_bdi_shipment_number ON production_files(bdi_shipment_number);
CREATE INDEX idx_production_files_file_type ON production_files(file_type);
CREATE INDEX idx_production_files_uploaded_by ON production_files(uploaded_by);
CREATE INDEX idx_production_files_created_at ON production_files(created_at);

-- Create GIN index for JSONB device metadata
CREATE INDEX idx_production_files_device_metadata ON production_files USING GIN (device_metadata);

-- Create GIN index for tags array
CREATE INDEX idx_production_files_tags ON production_files USING GIN (tags);

-- Enable Row Level Security
ALTER TABLE production_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Production Files

-- Users can view files from their own organization
CREATE POLICY "Users can view files from their organization" ON production_files
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- BDI users can view all files OR files marked as public to BDI
CREATE POLICY "BDI users can view all files or public files" ON production_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organizations o ON om.organization_uuid = o.id
      WHERE om.user_auth_id = auth.uid() 
      AND o.code = 'BDI'
    )
    OR is_public_to_bdi = true
    OR organization_id = ANY(allowed_organizations)
  );

-- Users can upload files for their organization
CREATE POLICY "Users can upload files for their organization" ON production_files
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- Users can update files from their organization
CREATE POLICY "Users can update files from their organization" ON production_files
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- Users can delete files from their organization (or BDI can delete any)
CREATE POLICY "Users can delete files from their organization" ON production_files
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organizations o ON om.organization_uuid = o.id
      WHERE om.user_auth_id = auth.uid() 
      AND o.code = 'BDI'
    )
  );

-- Create a function to generate BDI shipment numbers
CREATE OR REPLACE FUNCTION generate_bdi_shipment_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  sequence_num TEXT;
BEGIN
  current_year := TO_CHAR(NOW(), 'YY');
  
  -- Get next sequence number for this year (padded to 4 digits)
  SELECT LPAD((COUNT(*) + 1)::TEXT, 4, '0') INTO sequence_num
  FROM production_files 
  WHERE bdi_shipment_number LIKE 'BDI-' || current_year || '-%';
  
  RETURN 'BDI-' || current_year || '-' || sequence_num;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to auto-generate BDI shipment numbers if not provided
CREATE OR REPLACE FUNCTION set_bdi_shipment_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bdi_shipment_number IS NULL OR NEW.bdi_shipment_number = '' THEN
    NEW.bdi_shipment_number := generate_bdi_shipment_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_bdi_shipment_number
  BEFORE INSERT ON production_files
  FOR EACH ROW
  EXECUTE FUNCTION set_bdi_shipment_number();

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_production_files_updated_at
  BEFORE UPDATE ON production_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
