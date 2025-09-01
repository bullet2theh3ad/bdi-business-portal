# File Upload System Setup for Invoices

## 🎯 File Storage Options

### Option 1: Local File Storage (Simple)
```typescript
// Store files in public/uploads/invoices/
const uploadPath = `public/uploads/invoices/${invoiceId}/`;
```

### Option 2: Supabase Storage (Recommended)
```typescript
// Use Supabase Storage buckets
const { data, error } = await supabase.storage
  .from('invoice-documents')
  .upload(`${invoiceId}/${fileName}`, file);
```

### Option 3: AWS S3 (Enterprise)
```typescript
// Use AWS S3 for scalable storage
const uploadParams = {
  Bucket: 'bdi-invoice-documents',
  Key: `invoices/${invoiceId}/${fileName}`,
  Body: file
};
```

## 🔧 Implementation Steps

### 1. Create API Route for File Upload
Create: `app/api/cpfr/invoices/[id]/documents/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    const uploadedFiles = [];
    
    for (const file of files) {
      // Create upload directory
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'invoices', params.id);
      await fs.mkdir(uploadDir, { recursive: true });
      
      // Save file
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = path.join(uploadDir, file.name);
      await writeFile(filePath, buffer);
      
      // Save to database
      const docRecord = await db.insert(invoiceDocuments).values({
        invoiceId: params.id,
        fileName: file.name,
        filePath: `/uploads/invoices/${params.id}/${file.name}`,
        fileType: file.type,
        fileSize: file.size,
        uploadedBy: user.id
      });
      
      uploadedFiles.push(docRecord);
    }
    
    return NextResponse.json({ success: true, files: uploadedFiles });
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

### 2. Update Frontend to Handle File Upload
```typescript
const handleFileUpload = async (invoiceId: string, files: File[]) => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  
  const response = await fetch(`/api/cpfr/invoices/${invoiceId}/documents`, {
    method: 'POST',
    body: formData
  });
  
  if (response.ok) {
    const result = await response.json();
    console.log('Files uploaded:', result.files);
  }
};
```

### 3. File Access and Security
```typescript
// Serve files with authentication
export async function GET(request: NextRequest, { params }: { params: { id: string, filename: string } }) {
  // Verify user has access to invoice
  const hasAccess = await verifyInvoiceAccess(params.id, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  // Serve file
  const filePath = path.join(process.cwd(), 'public', 'uploads', 'invoices', params.id, params.filename);
  const file = await readFile(filePath);
  
  return new NextResponse(file, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${params.filename}"`
    }
  });
}
```

## 📁 Recommended File Structure
```
public/
  uploads/
    invoices/
      {invoice-id}/
        contract.pdf
        specifications.xlsx
        product-image.jpg
```

## 🔒 Security Considerations
1. **File Type Validation**: Only allow specific file types
2. **Size Limits**: Enforce maximum file sizes (10MB per file)
3. **Access Control**: Verify user permissions before serving files
4. **Sanitization**: Clean file names to prevent path traversal
5. **Virus Scanning**: Consider antivirus scanning for uploaded files

## 🚀 Next Steps
1. Run the SQL to create tables
2. Choose storage option (Supabase recommended)
3. Create API routes for file upload/download
4. Update frontend to handle file operations
5. Implement security and validation
