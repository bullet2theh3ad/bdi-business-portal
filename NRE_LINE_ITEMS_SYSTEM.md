# NRE Line Items System - 100% Private Document Processing

## 🔒 Privacy-First Architecture

**ALL processing happens locally on your server - NO external APIs!**
- ✅ pdf-parse: Local PDF text extraction
- ✅ mammoth: Local Word document extraction
- ✅ Regex-based categorization: Local pattern matching
- ❌ NO OpenAI, NO Google Cloud Vision, NO external services
- ✅ Your sensitive NRE data NEVER leaves your infrastructure

## 📋 System Components

### 1. Database Schema (`create-nre-line-items-table.sql`)

**Tables:**
- `nre_line_items` - Main table for tracking vendor quotes and line items
- `nre_categories` - Predefined categories with keywords for auto-categorization
- `nre_line_items_summary` - View for reporting and analytics

**10 Predefined Categories:**
1. **NRE Design** - Electrical + mechanical design hours
2. **Tooling** - Mold fabrication, test jigs, rework
3. **EVT/DVT/PVT** - Engineering, design, production validation builds
4. **Certifications** - FCC/UL/CE/RoHS testing
5. **Field Testing** - Pilot field trials and data logs
6. **ODM Setup** - One-time factory engineering or system setup
7. **Firmware** - Software dev + OTA integration
8. **Logistics Samples** - Shipments of early builds
9. **Warranty / Reliability** - HALT, burn-in, reliability testing
10. **Others** - Custom engineering costs, BOM validation

### 2. Document Processor (`lib/services/document-processor.ts`)

**Features:**
- Extracts text from PDFs and Word docs (100% local)
- Auto-categorizes line items using regex patterns
- Extracts vendor information (name, quote number, date)
- Parses amounts and line item descriptions
- Returns structured data ready for database insertion

**Supported Formats:**
- PDF (application/pdf)
- Word (.docx)

### 3. Upload Flow (`app/api/admin/rag-upload/route.ts`)

**Process:**
1. User uploads document to `nre-documents/COMPANY/`
2. File is stored in Supabase storage
3. Document is processed locally (text extraction)
4. Line items are auto-categorized
5. Data is inserted into `nre_line_items` table
6. User receives extracted line items for review

### 4. UI (`app/(dashboard)/admin/rag-upload/page.tsx`)

**Features:**
- Directory selector: `rag-documents` or `nre-documents`
- Company selection (BDI, MTN, CBN, etc.)
- Drag & drop file upload
- Real-time feedback on extraction results

## 🎯 Use Cases

### Vendor Quote Processing
1. Upload vendor quote PDF to `nre-documents/BDI/`
2. System extracts line items automatically
3. Each line item is categorized (Tooling, Firmware, etc.)
4. Amounts, descriptions, and vendor info are captured
5. Data is ready for approval workflow

### Reporting & Analytics
- View summary by category (total amounts, item counts)
- Track pending vs approved vs paid items
- Monitor due dates across all vendors
- Standardize line items over time for better forecasting

### Form Auto-Fill (Future)
- Extracted data can pre-populate forms
- User reviews and confirms/edits
- Reduces manual data entry errors
- Speeds up quote processing workflow

## 📊 Data Structure

```typescript
{
  document_id: UUID,
  vendor_name: "MTN High-Technology",
  quote_number: "Q-2025-001",
  quote_date: "2025-01-15",
  line_item_number: 1,
  description: "Mold fabrication for housing",
  category: "TOOLING",
  quantity: 1,
  unit_price: 5000.00,
  total_amount: 5000.00,
  currency: "USD",
  payment_terms: "NET30",
  due_date: "2025-02-15",
  status: "pending",
  confidence_score: 0.7
}
```

## 🚀 Next Steps

1. **Run SQL to create tables:**
   ```bash
   # Execute create-nre-line-items-table.sql in Supabase SQL Editor
   ```

2. **Test document upload:**
   - Go to `/admin/rag-upload`
   - Select `nre-documents` directory
   - Upload a vendor quote PDF
   - Check console for extraction results

3. **Build NRE Management UI:**
   - View all line items
   - Approve/reject items
   - Edit extracted data
   - Generate reports by category

4. **Add approval workflow:**
   - CFO approval for items over $X
   - Email notifications
   - Status tracking (pending → approved → paid)

## 🔐 Security & Privacy

- ✅ All document processing is local
- ✅ RLS policies restrict access to super_admin and admin_cfo
- ✅ Audit trail (created_by, created_at, updated_at)
- ✅ Soft deletes (deleted_at)
- ✅ No sensitive data sent to external APIs

## 📈 Benefits

1. **Privacy** - Sensitive vendor quotes stay on your infrastructure
2. **Speed** - Local processing is fast (no API latency)
3. **Cost** - No per-document API fees
4. **Standardization** - Consistent categorization across all quotes
5. **Reporting** - Easy to analyze NRE costs by category
6. **Audit Trail** - Track all changes and approvals

## 🛠️ Technical Stack

- **pdf-parse** - PDF text extraction (Node.js)
- **mammoth** - Word document extraction (Node.js)
- **PostgreSQL** - Data storage with JSONB for flexibility
- **Supabase** - File storage and database
- **TypeScript** - Type-safe processing logic
- **Next.js API Routes** - Server-side processing

---

**Remember: This system is designed for PRIVACY FIRST. Your sensitive NRE data never leaves your server!** 🔒
