# QuickBooks Completion & BDI Integration Plan

## 🎯 Phase 1: Complete QuickBooks Foundation (CURRENT)

### Priority Order:
1. **Items/Products** ⭐ (HIGHEST - Bridge to BDI SKUs)
2. **Payments** (Cash flow tracking)
3. **Bills** (Accounts Payable)
4. **Sales Receipts** (Cash sales)
5. **Credit Memos** (Returns/refunds)
6. **Purchase Orders** (Vendor orders)
7. **Accounts** (Chart of Accounts)
8. **Classes/Departments** (Cost centers)
9. **Profit & Loss** (Financial statement)
10. **Balance Sheet** (Financial position)

---

## 📦 STEP 1: Items/Products (The Bridge)

**Why First?**
- Core connection between QB and BDI SKUs
- Product catalog matching
- Cost of goods sold (COGS) tracking
- Inventory valuation
- Essential for invoice line items

**Database Schema:**
```sql
CREATE TABLE quickbooks_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_item_id TEXT NOT NULL,
  qb_sync_token TEXT,
  
  -- Item Details
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  type TEXT, -- Inventory, Service, NonInventory, etc.
  
  -- Pricing
  unit_price DECIMAL(15, 2),
  purchase_cost DECIMAL(15, 2),
  
  -- Inventory (if type = Inventory)
  qty_on_hand DECIMAL(15, 2),
  reorder_point DECIMAL(15, 2),
  
  -- Accounting
  income_account_ref TEXT,
  expense_account_ref TEXT,
  asset_account_ref TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  taxable BOOLEAN DEFAULT false,
  
  -- Metadata
  qb_created_at TIMESTAMPTZ,
  qb_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(connection_id, qb_item_id)
);

CREATE INDEX idx_qb_items_connection ON quickbooks_items(connection_id);
CREATE INDEX idx_qb_items_sku ON quickbooks_items(sku);
CREATE INDEX idx_qb_items_name ON quickbooks_items(name);
```

**API Endpoints:**
- `GET /api/quickbooks/items` - List all items
- `GET /api/quickbooks/items/[id]` - Item details
- `POST /api/quickbooks/sync` - Include items in sync

**UI Location:**
- New tab in Reports: "Products"
- Table with: Name, SKU, Type, Price, QOH, Status
- Search/filter by SKU or name

---

## 💰 STEP 2: Payments

**Schema:**
```sql
CREATE TABLE quickbooks_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES quickbooks_connections(id),
  qb_payment_id TEXT NOT NULL,
  qb_customer_id TEXT,
  customer_name TEXT,
  payment_date DATE,
  total_amount DECIMAL(15, 2),
  unapplied_amount DECIMAL(15, 2),
  payment_method TEXT,
  reference_number TEXT,
  deposit_to_account TEXT,
  line_items JSONB, -- Which invoices were paid
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, qb_payment_id)
);
```

---

## 📄 STEP 3: Bills (Accounts Payable)

**Schema:**
```sql
CREATE TABLE quickbooks_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES quickbooks_connections(id),
  qb_bill_id TEXT NOT NULL,
  qb_vendor_id TEXT,
  vendor_name TEXT,
  bill_date DATE,
  due_date DATE,
  total_amount DECIMAL(15, 2),
  balance DECIMAL(15, 2),
  payment_status TEXT,
  line_items JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, qb_bill_id)
);
```

---

## 📋 STEP 4-10: Other Entities (Simplified)

Similar pattern for:
- Sales Receipts
- Credit Memos
- Purchase Orders
- Accounts (Chart of Accounts)
- Classes/Departments

---

## 🔗 Phase 2: BDI Integration (After QB Complete)

### Integration Points:

**1. SKU Matching & Mapping**
```typescript
// New table: sku_quickbooks_mapping
CREATE TABLE sku_quickbooks_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bdi_sku_id UUID REFERENCES skus(id),
  qb_item_id TEXT,
  qb_connection_id UUID REFERENCES quickbooks_connections(id),
  mapping_confidence DECIMAL(3, 2), -- 0.00 to 1.00
  mapped_by UUID REFERENCES auth.users(id),
  mapping_type TEXT, -- 'manual', 'auto', 'suggested'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**2. Invoice Integration**
- Match QB Invoices to BDI CPFR Invoices
- Link QB Customers to BDI Organizations
- Sync payment status

**3. Cost Analysis**
- Compare QB costs vs BDI NRE Spend
- Match QB vendors to BDI suppliers
- Cost variance reporting

**4. Financial Dashboards**
- Combined P&L: QB + BDI data
- SKU profitability: QB revenue - BDI costs
- Customer profitability by organization

**5. Automated Workflows**
- When QB invoice paid → update CPFR status
- When BDI SKU created → suggest QB item match
- When QB item updated → sync to BDI SKU pricing

---

## 🎯 Implementation Order

### Week 1: Items/Products Foundation
1. Create `quickbooks_items` table
2. Update sync route to fetch Items
3. Create Items API endpoints
4. Add "Products" tab to Reports UI
5. Basic SKU search/filter

### Week 2: SKU Matching Interface
1. Create `sku_quickbooks_mapping` table
2. Build SKU matching UI
3. Auto-match algorithm (by SKU, name similarity)
4. Manual matching interface
5. Confidence scoring

### Week 3: Payments & Bills
1. Create Payments table & sync
2. Create Bills table & sync
3. Enhanced AR/AP reports
4. Cash flow analysis

### Week 4: Complete Remaining Entities
1. Sales Receipts
2. Credit Memos
3. Purchase Orders
4. Chart of Accounts

### Week 5: BDI Integration Phase 1
1. Invoice linking (QB ↔ BDI)
2. Customer/Organization mapping
3. Vendor matching

### Week 6: Advanced Analytics
1. SKU profitability dashboard
2. Combined financial reports
3. Cost variance analysis
4. Automated sync workflows

---

## 🚀 Let's Start with Items/Products!

**Files to Create/Modify:**
1. `create-quickbooks-items-table.sql` - Database schema
2. `app/api/quickbooks/sync/route.ts` - Add Items sync
3. `app/api/quickbooks/items/route.ts` - Items API
4. `app/(dashboard)/admin/quickbooks/reports/page.tsx` - Add Products tab

**Next Steps:**
1. Create database migration for Items
2. Update sync to fetch Items from QB
3. Build Products tab in UI
4. Test with your QB sandbox data

Ready to start? 🎯

