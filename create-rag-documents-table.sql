-- Create RAG documents table for god-mode AI prompting system
-- This stores metadata and tags for enhanced business intelligence

CREATE TABLE IF NOT EXISTS rag_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Storage path: rag-documents/[COMPANY]/filename
  company_code TEXT NOT NULL, -- BDI, MTN, CBN, EMG, OLM, etc.
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  tags TEXT[], -- Array of tags for god-mode AI context
  content_summary TEXT, -- AI-generated summary for quick reference
  upload_metadata JSONB, -- Additional metadata like timestamp, original name
  uploaded_by UUID NOT NULL REFERENCES users(auth_id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_analyzed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  analysis_status TEXT DEFAULT 'pending' -- pending, analyzed, failed
);

-- Create indexes for efficient querying
CREATE INDEX idx_rag_documents_company_code ON rag_documents(company_code);
CREATE INDEX idx_rag_documents_tags ON rag_documents USING GIN(tags);
CREATE INDEX idx_rag_documents_uploaded_by ON rag_documents(uploaded_by);
CREATE INDEX idx_rag_documents_uploaded_at ON rag_documents(uploaded_at DESC);
CREATE INDEX idx_rag_documents_analysis_status ON rag_documents(analysis_status);

-- Enable RLS
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;

-- Super admins can see all RAG documents
CREATE POLICY "Super admins can view all RAG documents"
ON rag_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE auth_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Super admins can insert RAG documents
CREATE POLICY "Super admins can insert RAG documents"
ON rag_documents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE auth_id = auth.uid() 
    AND role = 'super_admin'
  ) AND
  uploaded_by = auth.uid()
);

-- Super admins can update RAG documents
CREATE POLICY "Super admins can update RAG documents"
ON rag_documents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE auth_id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- Super admins can delete RAG documents
CREATE POLICY "Super admins can delete RAG documents"
ON rag_documents
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE auth_id = auth.uid() 
    AND role = 'super_admin'
  )
);
