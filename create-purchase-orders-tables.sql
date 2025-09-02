-- Create purchase_orders table (similar to invoices)
CREATE TABLE purchase_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_number VARCHAR(255) NOT NULL UNIQUE,
  supplier_name VARCHAR(255) NOT NULL,
  custom_supplier_name VARCHAR(255),
  purchase_order_date DATE NOT NULL,
  requested_delivery_week VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'shipped', 'delivered')),
  terms VARCHAR(100) NOT NULL DEFAULT 'NET30',
  incoterms VARCHAR(50) NOT NULL DEFAULT 'FOB',
  incoterms_location VARCHAR(255),
  total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(auth_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  organization_id UUID REFERENCES organizations(id)
);

-- Create purchase_order_line_items table (similar to invoice_line_items)
CREATE TABLE purchase_order_line_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  sku_id UUID REFERENCES product_skus(id),
  sku_code VARCHAR(255),
  sku_name VARCHAR(255),
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create purchase_order_documents table (similar to invoice_documents)
CREATE TABLE purchase_order_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT,
  content_type VARCHAR(100),
  uploaded_by UUID NOT NULL REFERENCES users(auth_id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_purchase_orders_supplier_name ON purchase_orders(supplier_name);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_created_by ON purchase_orders(created_by);
CREATE INDEX idx_purchase_orders_organization_id ON purchase_orders(organization_id);
CREATE INDEX idx_purchase_orders_created_at ON purchase_orders(created_at);

CREATE INDEX idx_purchase_order_line_items_po_id ON purchase_order_line_items(purchase_order_id);
CREATE INDEX idx_purchase_order_line_items_sku_id ON purchase_order_line_items(sku_id);

CREATE INDEX idx_purchase_order_documents_po_id ON purchase_order_documents(purchase_order_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_documents ENABLE ROW LEVEL SECURITY;

-- Purchase Orders RLS Policies
CREATE POLICY "Users can view purchase orders from their organization" ON purchase_orders
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert purchase orders for their organization" ON purchase_orders
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can update purchase orders from their organization" ON purchase_orders
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete purchase orders from their organization" ON purchase_orders
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_uuid 
      FROM organization_members 
      WHERE user_auth_id = auth.uid()
    )
  );

-- Purchase Order Line Items RLS Policies
CREATE POLICY "Users can view line items for purchase orders from their organization" ON purchase_order_line_items
  FOR SELECT USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE organization_id IN (
        SELECT organization_uuid 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage line items for purchase orders from their organization" ON purchase_order_line_items
  FOR ALL USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE organization_id IN (
        SELECT organization_uuid 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  );

-- Purchase Order Documents RLS Policies
CREATE POLICY "Users can view documents for purchase orders from their organization" ON purchase_order_documents
  FOR SELECT USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE organization_id IN (
        SELECT organization_uuid 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage documents for purchase orders from their organization" ON purchase_order_documents
  FOR ALL USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE organization_id IN (
        SELECT organization_uuid 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  );

-- Add triggers to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_order_line_items_updated_at BEFORE UPDATE ON purchase_order_line_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
