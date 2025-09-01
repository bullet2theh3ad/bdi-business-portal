# Supabase Storage Setup Guide

## 🎯 Supabase Storage Configuration

### 1. Create Storage Bucket in Supabase Dashboard

1. **Go to Supabase Dashboard** → Your Project → Storage
2. **Create New Bucket**: 
   - Name: `bdi-documents`
   - Public: `false` (private bucket for security)
3. **Set Bucket Policies** for access control

### 2. Storage Bucket Policies (RLS)

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to read their own organization's files
CREATE POLICY "Allow organization file access" ON storage.objects
FOR SELECT USING (
  auth.uid() IN (
    SELECT auth_id FROM users 
    WHERE organization_id = (
      SELECT organization_id FROM users WHERE auth_id = auth.uid()
    )
  )
);

-- Allow users to delete their own uploads
CREATE POLICY "Allow delete own files" ON storage.objects
FOR DELETE USING (
  auth.uid() = (
    SELECT uploaded_by FROM invoice_documents 
    WHERE file_path = storage.objects.name
  )
);
```

### 3. Environment Variables

Add to your `.env.local`:
```env
# Supabase Storage (already configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. File Organization Structure

```
bdi-documents/ (bucket)
├── invoices/
│   ├── {invoice-id}/
│   │   ├── contract_1234567890.pdf
│   │   ├── specifications_1234567891.xlsx
│   │   └── product-image_1234567892.jpg
├── skus/
│   ├── {sku-id}/
│   │   ├── datasheet_1234567893.pdf
│   │   └── photo_1234567894.jpg
├── users/
│   ├── avatars/
│   │   └── {user-id}_avatar_1234567895.jpg
└── organizations/
    ├── {org-id}/
    │   ├── certificate_1234567896.pdf
    │   └── license_1234567897.pdf
```

## 🔧 Implementation Benefits

### ✅ Centralized File Management
- **One system** for all file uploads across the entire app
- **Consistent API** for invoices, SKUs, users, organizations
- **Reusable functions** for upload, download, delete operations

### ✅ Security & Access Control
- **Private bucket** - files not publicly accessible
- **Authentication required** - only logged-in users can access
- **Organization-based access** - users only see their org's files
- **Signed URLs** - temporary secure access to files

### ✅ Professional Features
- **File validation** - type and size checking
- **Unique naming** - prevents conflicts with timestamps
- **Metadata tracking** - file info stored in database
- **Progress tracking** - for multiple file uploads

## 🚀 Next Steps

1. **Create Supabase bucket** (`bdi-documents`)
2. **Set bucket policies** for security
3. **Create upload API routes** using the storage functions
4. **Update frontend** to use real file upload
5. **Test file upload/download** workflow

**This system will handle ALL file uploads across your entire application!** ✨
