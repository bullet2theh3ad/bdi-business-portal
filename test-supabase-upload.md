# How to Test Supabase File Uploads

## 🧪 Testing File Upload to Supabase Storage

### Step 1: Check Supabase Dashboard
1. **Go to Supabase Dashboard** → Your Project → Storage
2. **Click on `bdi-documents` bucket**
3. **Look for folder structure**: `invoices/{invoice-id}/`
4. **Check uploaded files** appear with proper names

### Step 2: Console Debugging
**Open browser console (F12) and look for:**

```javascript
// When selecting files:
"Files selected for upload: ['contract.pdf', 'specs.xlsx']"

// When creating invoice:
"Creating Invoice with data: { invoiceNumber: 'INV-2025-001', ... }"
"Created invoice: { id: 'abc123...', invoiceNumber: 'INV-2025-001' }"

// When uploading files:
"Uploading 2 documents to invoice abc123..."
"✅ Files uploaded successfully: { uploaded: 2, failed: 0, files: [...] }"

// Or if upload fails:
"❌ File upload failed"
```

### Step 3: Network Tab Monitoring
**In browser DevTools → Network tab:**

1. **Create Invoice**: Look for `POST /api/cpfr/invoices` (should return 200)
2. **Upload Files**: Look for `POST /api/cpfr/invoices/{id}/documents` (should return 200)
3. **Check Response**: Should show uploaded file paths and URLs

### Step 4: Verify in Supabase Storage
**Expected file structure:**
```
bdi-documents/
├── invoices/
│   ├── abc123-def456-ghi789/
│   │   ├── contract_1234567890.pdf
│   │   ├── specifications_1234567891.xlsx
│   │   └── product-image_1234567892.jpg
```

### Step 5: Test File Access
**Check if files are accessible:**
```javascript
// In browser console, test file access:
fetch('/api/cpfr/invoices/{invoice-id}/documents/{filename}')
  .then(response => console.log('File access:', response.status))
```

## 🔧 Troubleshooting

### If Files Don't Upload:
1. **Check bucket exists**: `bdi-documents` in Supabase
2. **Check bucket is private**: Public = false
3. **Check RLS policies**: Need to add storage policies
4. **Check console errors**: Look for Supabase auth issues

### If Upload Returns 403:
- **Set bucket policies** from `supabase-storage-setup.md`
- **Enable RLS** on storage bucket
- **Check user authentication** in console

### If Files Upload but Can't Access:
- **Check signed URLs** are being generated
- **Verify file paths** match storage structure
- **Check download permissions** in bucket policies

## 🎯 Expected Success Indicators:
- ✅ **Console**: "✅ Files uploaded successfully"
- ✅ **Alert**: "Invoice created with X documents uploaded to Supabase!"
- ✅ **Supabase Dashboard**: Files visible in bucket
- ✅ **Network Tab**: 200 responses for upload requests
