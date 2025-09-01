-- Simplified Supabase Storage Setup (Run as individual commands)
-- Copy and paste these ONE AT A TIME in Supabase SQL Editor

-- 1. First, create the bucket (this might already exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-documents',
  'organization-documents',
  false,
  52428800,
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
) ON CONFLICT (id) DO NOTHING;

-- 2. Check if bucket was created
SELECT * FROM storage.buckets WHERE id = 'organization-documents';

-- 3. Grant permissions on invoice_documents table
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_documents TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 4. Verify your organization membership (replace with your actual auth ID)
SELECT 
  u.email,
  u.role,
  u.auth_id,
  om.organization_uuid,
  o.name as organization_name
FROM users u
JOIN organization_members om ON u.auth_id = om.user_auth_id
JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email = 'scistulli@boundlessdevices.com';
