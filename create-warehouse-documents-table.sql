-- Create warehouse_documents table for storing warehouse-specific documents

CREATE TABLE IF NOT EXISTS warehouse_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL DEFAULT 'OTHER' CHECK (document_type IN (
    'CONTRACT', 'CERTIFICATION', 'INSURANCE', 'LICENSE', 'INSPECTION', 'OTHER'
  )),
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(auth_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_warehouse_documents_warehouse_id ON warehouse_documents(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_documents_uploaded_by ON warehouse_documents(uploaded_by);

-- Verify table creation
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'warehouse_documents' 
ORDER BY ordinal_position;
