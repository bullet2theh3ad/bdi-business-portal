-- Create shipments table for international logistics management
CREATE TABLE shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_number VARCHAR(100) NOT NULL UNIQUE,
  forecast_id UUID REFERENCES sales_forecasts(id),
  
  -- Origin Information
  origin_warehouse_id UUID REFERENCES warehouses(id),
  origin_custom_location TEXT,
  
  -- Destination Information  
  destination_warehouse_id UUID REFERENCES warehouses(id),
  destination_custom_location TEXT NOT NULL,
  destination_country VARCHAR(100) NOT NULL,
  destination_port VARCHAR(100),
  
  -- Logistics Details
  shipping_method VARCHAR(50) NOT NULL CHECK (shipping_method IN (
    'AIR_EXPRESS', 'AIR_STANDARD', 'SEA_FCL', 'SEA_LCL', 'TRUCK', 'RAIL', 'INTERMODAL'
  )),
  container_type VARCHAR(20) NOT NULL CHECK (container_type IN (
    '20ft', '40ft', '40ft_HC', '45ft', 'AIR_ULD', 'TRUCK_TRAILER'
  )),
  incoterms VARCHAR(10) NOT NULL,
  incoterms_location VARCHAR(255) NOT NULL,
  
  -- Container Details (JSONB for flexibility)
  container_details JSONB NOT NULL DEFAULT '{
    "containerNumber": null,
    "sealNumber": null,
    "weight": 0,
    "volume": 0,
    "palletCount": 0,
    "utilization": 0
  }',
  
  -- Customs & Compliance Information
  customs_info JSONB NOT NULL DEFAULT '{
    "htsCode": "",
    "commercialValue": 0,
    "customsBroker": null,
    "importLicense": null,
    "specialPermits": [],
    "cbpFiling": null,
    "euEori": null
  }',
  
  -- Timeline
  estimated_departure TIMESTAMP WITH TIME ZONE NOT NULL,
  estimated_arrival TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_departure TIMESTAMP WITH TIME ZONE,
  actual_arrival TIMESTAMP WITH TIME ZONE,
  
  -- Status and Tracking
  status VARCHAR(50) NOT NULL DEFAULT 'planning' CHECK (status IN (
    'planning', 'booked', 'in_transit', 'customs_clearance', 'delivered', 'delayed', 'cancelled'
  )),
  tracking_number VARCHAR(100),
  
  -- Metadata
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(auth_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  organization_id UUID REFERENCES organizations(id)
);

-- Create shipment_line_items table for flexible SKU management
CREATE TABLE shipment_line_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES product_skus(id),
  
  -- Quantity and Physical Details
  quantity INTEGER NOT NULL,
  pallet_count INTEGER NOT NULL DEFAULT 1,
  weight_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
  volume_m3 DECIMAL(10,3) NOT NULL DEFAULT 0,
  
  -- Customs and Value
  hts_code VARCHAR(12),
  unit_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shipment_documents table for shipping documentation
CREATE TABLE shipment_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
    'COMMERCIAL_INVOICE', 'PACKING_LIST', 'BILL_OF_LADING', 'CERTIFICATE_OF_ORIGIN',
    'CUSTOMS_DECLARATION', 'INSURANCE_CERTIFICATE', 'INSPECTION_CERTIFICATE', 'OTHER'
  )),
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT,
  content_type VARCHAR(100),
  uploaded_by UUID NOT NULL REFERENCES users(auth_id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shipment_tracking table for status updates
CREATE TABLE shipment_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  location VARCHAR(255),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  updated_by UUID REFERENCES users(auth_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_shipments_number ON shipments(shipment_number);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_method ON shipments(shipping_method);
CREATE INDEX idx_shipments_destination_country ON shipments(destination_country);
CREATE INDEX idx_shipments_forecast_id ON shipments(forecast_id);
CREATE INDEX idx_shipments_organization_id ON shipments(organization_id);
CREATE INDEX idx_shipments_created_at ON shipments(created_at);

CREATE INDEX idx_shipment_line_items_shipment_id ON shipment_line_items(shipment_id);
CREATE INDEX idx_shipment_line_items_sku_id ON shipment_line_items(sku_id);

CREATE INDEX idx_shipment_documents_shipment_id ON shipment_documents(shipment_id);
CREATE INDEX idx_shipment_documents_type ON shipment_documents(document_type);

CREATE INDEX idx_shipment_tracking_shipment_id ON shipment_tracking(shipment_id);
CREATE INDEX idx_shipment_tracking_timestamp ON shipment_tracking(timestamp);

-- Add RLS (Row Level Security) policies
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_tracking ENABLE ROW LEVEL SECURITY;

-- Shipments RLS Policies
CREATE POLICY "Users can view shipments from their organization" ON shipments
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage shipments for their organization" ON shipments
  FOR ALL USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- Shipment Line Items RLS Policies
CREATE POLICY "Users can view line items for shipments from their organization" ON shipment_line_items
  FOR SELECT USING (
    shipment_id IN (
      SELECT id FROM shipments WHERE organization_id IN (
        SELECT organization_uuid 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage line items for shipments from their organization" ON shipment_line_items
  FOR ALL USING (
    shipment_id IN (
      SELECT id FROM shipments WHERE organization_id IN (
        SELECT organization_uuid 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  );

-- Shipment Documents RLS Policies
CREATE POLICY "Users can view documents for shipments from their organization" ON shipment_documents
  FOR SELECT USING (
    shipment_id IN (
      SELECT id FROM shipments WHERE organization_id IN (
        SELECT organization_uuid 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage documents for shipments from their organization" ON shipment_documents
  FOR ALL USING (
    shipment_id IN (
      SELECT id FROM shipments WHERE organization_id IN (
        SELECT organization_uuid 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  );

-- Shipment Tracking RLS Policies
CREATE POLICY "Users can view tracking for shipments from their organization" ON shipment_tracking
  FOR SELECT USING (
    shipment_id IN (
      SELECT id FROM shipments WHERE organization_id IN (
        SELECT organization_uuid 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can add tracking updates for shipments from their organization" ON shipment_tracking
  FOR INSERT WITH CHECK (
    shipment_id IN (
      SELECT id FROM shipments WHERE organization_id IN (
        SELECT organization_uuid 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  );

-- Add triggers to update updated_at timestamps
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shipment_line_items_updated_at BEFORE UPDATE ON shipment_line_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
