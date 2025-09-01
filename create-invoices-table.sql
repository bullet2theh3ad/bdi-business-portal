-- Create Invoices table for Proforma Invoice management
-- Run this SQL in your PostgreSQL database

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Invoice Details
  invoice_number VARCHAR(100) NOT NULL UNIQUE,
  customer_name VARCHAR(255) NOT NULL,
  invoice_date TIMESTAMP NOT NULL,
  requested_delivery_week TIMESTAMP,
  
  -- Status and Business Terms
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'shipped', 'delivered')),
  terms VARCHAR(100), -- NET30, NET60, etc.
  incoterms VARCHAR(20), -- FOB, CIF, DDP, etc.
  incoterms_location VARCHAR(255), -- Shanghai Port, Los Angeles, etc.
  
  -- Financial
  total_value DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  
  -- Supporting Documents (JSON array of file paths/URLs)
  documents JSONB DEFAULT '[]',
  
  -- Additional Info
  notes TEXT,
  
  -- Audit Fields
  created_by UUID NOT NULL REFERENCES users(auth_id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes separately for performance
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_customer_name ON invoices(customer_name);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_created_by ON invoices(created_by);
CREATE INDEX idx_invoices_created_at ON invoices(created_at);

-- Create Invoice Line Items table
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES product_skus(id),
  
  -- Line Item Details
  sku_code VARCHAR(100) NOT NULL,
  sku_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost DECIMAL(15,2) NOT NULL CHECK (unit_cost >= 0),
  line_total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for line items
CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_sku_id ON invoice_line_items(sku_id);
CREATE INDEX idx_invoice_line_items_sku_code ON invoice_line_items(sku_code);

-- Create trigger to update line_total automatically
CREATE OR REPLACE FUNCTION update_line_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.line_total = NEW.quantity * NEW.unit_cost;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_line_total
  BEFORE INSERT OR UPDATE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_line_total();

-- Create trigger to update invoice total_value when line items change
CREATE OR REPLACE FUNCTION update_invoice_total()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the invoice total based on sum of line items
  UPDATE invoices 
  SET 
    total_value = (
      SELECT COALESCE(SUM(line_total), 0) 
      FROM invoice_line_items 
      WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_total
  AFTER INSERT OR UPDATE OR DELETE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_total();

-- Create Documents Upload table for file management
CREATE TABLE invoice_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Key
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  
  -- File Details
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL, -- Storage path (S3, local, etc.)
  file_type VARCHAR(100) NOT NULL, -- MIME type
  file_size BIGINT NOT NULL, -- Size in bytes
  
  -- Upload Info
  uploaded_by UUID NOT NULL REFERENCES users(auth_id),
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for documents
CREATE INDEX idx_invoice_documents_invoice_id ON invoice_documents(invoice_id);
CREATE INDEX idx_invoice_documents_uploaded_by ON invoice_documents(uploaded_by);

-- Add comments for documentation
COMMENT ON TABLE invoices IS 'Proforma invoices for customer orders with line items and document management';
COMMENT ON TABLE invoice_line_items IS 'Individual SKU line items within invoices with quantities and pricing';
COMMENT ON TABLE invoice_documents IS 'Supporting documents uploaded for invoices (contracts, specifications, etc.)';

-- Verify tables created
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name IN ('invoices', 'invoice_line_items', 'invoice_documents')
ORDER BY table_name;
