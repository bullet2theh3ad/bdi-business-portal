-- Create storage buckets for document management
-- Run these commands in your Supabase SQL Editor

-- 1. Create the main documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-documents',
  'organization-documents',
  false, -- Private bucket (requires authentication)
  52428800, -- 50MB limit per file
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'text/csv'
  ]
);

-- 2. Create RLS policies for the documents bucket
-- Allow authenticated users to upload files to their organization folder
CREATE POLICY "Users can upload to their organization folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  bucket_id = 'organization-documents' AND
  (storage.foldername(name))[1] = (
    SELECT o.id::text 
    FROM organizations o 
    JOIN organization_members om ON o.id = om.organization_uuid 
    JOIN users u ON om.user_auth_id = u.auth_id 
    WHERE u.auth_id = auth.uid()
  )
);

-- Allow users to view files from their organization
CREATE POLICY "Users can view their organization files"
ON storage.objects
FOR SELECT
USING (
  auth.role() = 'authenticated' AND
  bucket_id = 'organization-documents' AND
  (storage.foldername(name))[1] = (
    SELECT o.id::text 
    FROM organizations o 
    JOIN organization_members om ON o.id = om.organization_uuid 
    JOIN users u ON om.user_auth_id = u.auth_id 
    WHERE u.auth_id = auth.uid()
  )
);

-- Allow users to delete files from their organization (admin/super_admin only)
CREATE POLICY "Admins can delete organization files"
ON storage.objects
FOR DELETE
USING (
  auth.role() = 'authenticated' AND
  bucket_id = 'organization-documents' AND
  (storage.foldername(name))[1] = (
    SELECT o.id::text 
    FROM organizations o 
    JOIN organization_members om ON o.id = om.organization_uuid 
    JOIN users u ON om.user_auth_id = u.auth_id 
    WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'super_admin')
  )
);

-- Allow users to update files from their organization (admin/super_admin only)
CREATE POLICY "Admins can update organization files"
ON storage.objects
FOR UPDATE
USING (
  auth.role() = 'authenticated' AND
  bucket_id = 'organization-documents' AND
  (storage.foldername(name))[1] = (
    SELECT o.id::text 
    FROM organizations o 
    JOIN organization_members om ON o.id = om.organization_uuid 
    JOIN users u ON om.user_auth_id = u.auth_id 
    WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'super_admin')
  )
);

-- 3. Create a table to track uploaded documents metadata
CREATE TABLE IF NOT EXISTS organization_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(auth_id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Storage path in Supabase
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  category TEXT NOT NULL, -- 'business', 'banking', 'legal', 'technical', 'compliance', 'contracts'
  subcategory TEXT, -- Optional subcategory like 'incorporation', 'tax-documents', etc.
  description TEXT,
  tags TEXT[], -- Array of tags for better organization
  is_required BOOLEAN DEFAULT false,
  is_confidential BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_organization_documents_org_id ON organization_documents(organization_id);
CREATE INDEX idx_organization_documents_category ON organization_documents(category);
CREATE INDEX idx_organization_documents_uploaded_by ON organization_documents(uploaded_by);

-- Add RLS to the documents table
ALTER TABLE organization_documents ENABLE ROW LEVEL SECURITY;

-- Users can only see documents from their organization
CREATE POLICY "Users can view their organization documents"
ON organization_documents
FOR SELECT
USING (
  organization_id IN (
    SELECT o.id 
    FROM organizations o 
    JOIN organization_members om ON o.id = om.organization_uuid 
    JOIN users u ON om.user_auth_id = u.auth_id 
    WHERE u.auth_id = auth.uid()
  )
);

-- Users can insert documents to their organization
CREATE POLICY "Users can upload documents to their organization"
ON organization_documents
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT o.id 
    FROM organizations o 
    JOIN organization_members om ON o.id = om.organization_uuid 
    JOIN users u ON om.user_auth_id = u.auth_id 
    WHERE u.auth_id = auth.uid()
  ) AND
  uploaded_by = auth.uid()
);

-- Only admins can update/delete documents
CREATE POLICY "Admins can update organization documents"
ON organization_documents
FOR UPDATE
USING (
  organization_id IN (
    SELECT o.id 
    FROM organizations o 
    JOIN organization_members om ON o.id = om.organization_uuid 
    JOIN users u ON om.user_auth_id = u.auth_id 
    WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can delete organization documents"
ON organization_documents
FOR DELETE
USING (
  organization_id IN (
    SELECT o.id 
    FROM organizations o 
    JOIN organization_members om ON o.id = om.organization_uuid 
    JOIN users u ON om.user_auth_id = u.auth_id 
    WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'super_admin')
  )
);

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organization_documents_updated_at 
    BEFORE UPDATE ON organization_documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
