-- Fix RLS policy for shipment document uploads

-- First, check if the bucket exists and create if needed
INSERT INTO storage.buckets (id, name, public)
VALUES ('shipment-documents', 'shipment-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policy for shipment documents storage
CREATE POLICY "Users can upload shipment documents for their organization" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'shipment-documents' AND
  (storage.foldername(name))[1] = 'shipments' AND
  auth.uid() IN (
    SELECT auth_id FROM users WHERE id IN (
      SELECT created_by FROM shipments WHERE 
      id = (storage.foldername(name))[2]::uuid AND
      organization_id IN (
        SELECT organization_uuid 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can view shipment documents for their organization" ON storage.objects
FOR SELECT USING (
  bucket_id = 'shipment-documents' AND
  (storage.foldername(name))[1] = 'shipments' AND
  auth.uid() IN (
    SELECT auth_id FROM users WHERE id IN (
      SELECT created_by FROM shipments WHERE 
      id = (storage.foldername(name))[2]::uuid AND
      organization_id IN (
        SELECT organization_uuid 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can delete shipment documents for their organization" ON storage.objects
FOR DELETE USING (
  bucket_id = 'shipment-documents' AND
  (storage.foldername(name))[1] = 'shipments' AND
  auth.uid() IN (
    SELECT auth_id FROM users WHERE id IN (
      SELECT created_by FROM shipments WHERE 
      id = (storage.foldername(name))[2]::uuid AND
      organization_id IN (
        SELECT organization_uuid 
        FROM organization_members 
        WHERE user_auth_id = auth.uid()
      )
    )
  )
);
