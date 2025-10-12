# 📦 Warehouse WIP Flow Implementation Plan

## 🎯 Project Overview

This system adapts the "WIP Flow Prototype" concept to the BDI Portal for tracking CATV intake, warehouse repair operations, RMA processing, and outflow. It uses your existing stack (Next.js, Drizzle, Supabase, Tailwind, shadcn/ui) and integrates with your current warehouse and CATV reports.

**Data Source**: `Weekly_Report_2025-10-11_1909_wip_ok.xlsx`
- **Sheet 1 ("Raw Data")**: Individual unit records with serial numbers, dates, and status
- **Sheet 2 ("Weekly Summary")**: Aggregated metrics by ISO week

---

## 📋 Baby Steps Approach

We're building this incrementally to avoid breaking anything and to allow testing at each stage.

### ✅ Phase 1: Foundation (COMPLETE)

**What We've Built:**
1. **Database Schema** (`create-warehouse-wip-tables.sql`)
   - `warehouse_wip_units` - Individual unit tracking
   - `warehouse_wip_imports` - Import batch tracking
   - `warehouse_wip_weekly_summary` - Weekly aggregated metrics
   - Auto-computing triggers for derived fields (stage, aging, etc.)
   - RLS policies for access control

2. **TypeScript Types** (`lib/types/wip.ts`)
   - `WIPUnit` - Unit record interface
   - `WIPImportBatch` - Import tracking
   - `WIPWeeklySummary` - Weekly metrics
   - `SankeyData`, `CumulativeFlowDataPoint`, etc. - Visualization types

3. **Excel Parser** (`lib/services/wip-excel-parser.ts`)
   - Parses "Raw Data" sheet → `WIPUnit[]`
   - Parses "Weekly Summary" sheet → `WeeklyMatrix`
   - Handles date parsing from Excel formats
   - Validates data quality

**Next Steps:**
- Run the SQL migration
- Install xlsx package if not present
- Test parser locally

---

### 🔄 Phase 2: Data Ingestion (NEXT)

**What to Build:**

1. **API Routes**
   - `POST /api/warehouse/wip/import` - Upload Excel file
   - `GET /api/warehouse/wip/imports` - List import batches
   - `GET /api/warehouse/wip/imports/[id]` - Get batch details

2. **Admin Page** (`/admin/warehouse-wip`)
   - File upload interface
   - Import history table
   - Import status tracking
   - Basic error handling

3. **Background Processing**
   - Parse Excel file
   - Insert units into database
   - Compute summary stats
   - Handle duplicate serials

**Files to Create:**
```
app/api/warehouse/wip/import/route.ts
app/api/warehouse/wip/imports/route.ts
app/api/warehouse/wip/imports/[id]/route.ts
app/(dashboard)/admin/warehouse-wip/page.tsx
```

**Estimated Time**: 2-3 hours

---

### 📊 Phase 3: Basic Dashboard (AFTER PHASE 2)

**What to Build:**

1. **Dashboard Page** (`/admin/warehouse-wip/dashboard`)
   - Story Cards:
     - Total Intake (period)
     - Active WIP
     - RMA In Process
     - Total Outflow
   - Filters:
     - Date Range
     - SKU (Model Number)
     - Source
     - Stage

2. **API Routes**
   - `GET /api/warehouse/wip/metrics` - Dashboard metrics
   - `GET /api/warehouse/wip/units` - Filterable unit list

3. **Components**
   - `components/warehouse-wip/StoryCards.tsx`
   - `components/warehouse-wip/Filters.tsx`
   - `components/warehouse-wip/UnitsTable.tsx`

**Estimated Time**: 3-4 hours

---

### 📈 Phase 4: Visualizations (AFTER PHASE 3)

**What to Build:**

1. **Sankey Flow Diagram**
   - Shows flow: Intake → WIP → RMA → Outflow
   - Filterable by date, SKU, source
   - API: `GET /api/warehouse/wip/flow`

2. **Cumulative Flow Diagram**
   - Stacked area chart by ISO week
   - Shows accumulation of stages over time
   - API: `GET /api/warehouse/wip/cfd`

3. **WIP Aging Analysis**
   - Bar chart with buckets: 0-7, 8-14, 15-30, >30 days
   - Shows how long units sit in each stage
   - API: `GET /api/warehouse/wip/aging`

4. **Components**
   - `components/warehouse-wip/FlowSankey.tsx`
   - `components/warehouse-wip/CumulativeFlow.tsx`
   - `components/warehouse-wip/WIPAging.tsx`

**Dependencies**: Install `recharts` if not present

**Estimated Time**: 4-5 hours

---

### 📅 Phase 5: Weekly Summary (AFTER PHASE 4)

**What to Build:**

1. **Weekly Summary Page** (`/admin/warehouse-wip/weekly`)
   - Week selector dropdown
   - Delta cards (WoW comparisons)
   - Weekly trends (line charts)
   - WIP cumulative trend
   - SKU leaders
   - Exception detection

2. **API Routes**
   - `GET /api/warehouse/wip/weekly/summary` - Get weekly metrics
   - `GET /api/warehouse/wip/weekly/leaders` - Top SKUs by week

3. **Components**
   - `components/warehouse-wip/WeeklyFilters.tsx`
   - `components/warehouse-wip/WeeklyDeltaCards.tsx`
   - `components/warehouse-wip/WeeklyTrends.tsx`
   - `components/warehouse-wip/SKULeaders.tsx`

**Estimated Time**: 3-4 hours

---

### 🔗 Phase 6: Integration & Polish (FINAL)

**What to Build:**

1. **Sidebar Integration**
   - Add "📦 WIP Flow" menu under Admin or Inventory
   - Submenu: Dashboard, Weekly Summary, Import Data

2. **Exception Detection**
   - Auto-flag units with issues
   - Aging thresholds
   - Missing data
   - WIP increasing while outflow decreasing

3. **Export Functionality**
   - CSV export of filtered units
   - PDF report generation
   - Email alerts for exceptions

4. **Performance Optimization**
   - Add database indexes
   - Cache aggregated metrics
   - Pagination for large datasets

**Estimated Time**: 2-3 hours

---

## 🚀 Implementation Steps (Phase 2 - Start Here)

### Step 1: Run Database Migration

```bash
# Connect to Supabase and run the migration
psql <your-supabase-connection-string> -f create-warehouse-wip-tables.sql

# Or use Supabase CLI
supabase db push
```

### Step 2: Install Dependencies

```bash
# Install xlsx package for Excel parsing
pnpm add xlsx

# Install types
pnpm add -D @types/node
```

### Step 3: Test Excel Parser

Create a test script to verify the parser works:

```typescript
// test-wip-parser.ts
import { parseWIPExcelFile } from './lib/services/wip-excel-parser';

const result = parseWIPExcelFile('./Weekly_Report_2025-10-11_1909_wip_ok.xlsx');
console.log('Units parsed:', result.units.length);
console.log('Weekly summary:', result.weeklySummary ? 'Yes' : 'No');
console.log('Sample unit:', result.units[0]);
```

Run: `tsx test-wip-parser.ts`

### Step 4: Create Import API Route

Create `/app/api/warehouse/wip/import/route.ts`:
- Accept file upload
- Call parser
- Insert into database
- Return import batch ID

### Step 5: Create Admin Page

Create `/app/(dashboard)/admin/warehouse-wip/page.tsx`:
- File upload form
- Import history table
- Status indicators

### Step 6: Test Import Flow

1. Upload the Excel file
2. Verify units are inserted
3. Check summary stats
4. Review any errors

---

## 🎨 Design Guidelines

**Consistency with Existing Portal:**
- Use existing shadcn/ui components
- Match color schemes (green for success, blue for info, purple for analytics)
- Follow mobile-responsive patterns
- Use lucide-react icons
- Maintain card-based layouts

**Color Coding for Stages:**
- **Intake**: Blue (#3b82f6)
- **WIP**: Orange (#f59e0b)
- **RMA**: Red (#ef4444)
- **Outflow**: Green (#10b981)

**Aging Color Coding:**
- **0-7 days**: Green (healthy)
- **8-14 days**: Yellow (watch)
- **15-30 days**: Orange (concern)
- **>30 days**: Red (alert)

---

## 📊 Key Metrics to Track

### Dashboard Metrics
- Total units received (period)
- Active WIP count
- RMA in process count
- Total outflow (period)
- Average aging (all stages)
- Average aging (WIP only)

### Weekly Metrics
- Received (IN) WoW Δ
- Jira Shipped (OUT) WoW Δ
- EMG Shipped (OUT) WoW Δ
- WIP (IN HOUSE) WoW Δ
- WIP Cumulative trend

### Exception Indicators
- Units >30 days in WIP
- Units >45 days in RMA
- Missing outflow data
- Source="CATV" but not received
- WIP flag mismatch with stage

---

## 🔒 Security & Access Control

**Who Can Access:**
- Super Admins: Full access
- Admin: Full access
- Operations: Full access
- Other roles: No access (via RLS policies)

**Data Privacy:**
- Serial numbers visible only to authorized users
- Excel files stored temporarily, deleted after import
- Import history retained for audit trail

---

## 🧪 Testing Checklist

### Phase 2 (Import)
- [ ] SQL migration runs successfully
- [ ] Excel parser extracts all expected columns
- [ ] Date parsing handles Excel formats
- [ ] Units insert into database correctly
- [ ] Derived fields (stage, aging) compute correctly
- [ ] Import batch tracking works
- [ ] Duplicate serials handled gracefully
- [ ] Error logging works

### Phase 3 (Dashboard)
- [ ] Story cards show correct counts
- [ ] Filters apply correctly
- [ ] Date range filter works
- [ ] SKU filter works
- [ ] Source filter works
- [ ] Units table displays correctly
- [ ] Pagination works
- [ ] Mobile responsive

### Phase 4 (Visualizations)
- [ ] Sankey diagram shows flow correctly
- [ ] Cumulative flow chart stacks correctly
- [ ] Aging chart buckets correctly
- [ ] Tooltips show accurate data
- [ ] Charts filter correctly
- [ ] Empty states display

### Phase 5 (Weekly)
- [ ] Weekly summary parses correctly
- [ ] Week selector works
- [ ] Delta calculations correct
- [ ] WoW comparisons accurate
- [ ] SKU leaders compute correctly
- [ ] Trends display correctly

---

## 📝 Notes & Considerations

1. **ISO Week Handling**: We use ISO 8601 week numbering. Week 1 starts on the Monday nearest January 1st.

2. **Excel File Location**: For now, file is at project root. Later, consider:
   - Cloud storage (S3, Supabase Storage)
   - User upload via UI
   - Automatic sync from source system

3. **Performance**: With large datasets (>10K units), consider:
   - Batch processing for imports
   - Materialized views for aggregations
   - Caching computed metrics

4. **Future Enhancements**:
   - Real-time updates via webhooks
   - Mobile app for warehouse scanning
   - Integration with shipping systems
   - Predictive analytics for WIP bottlenecks
   - Cost tracking (Finance mode)

---

## 🆘 Troubleshooting

### "Sheet not found" Error
- Verify sheet names in Excel exactly match: "Raw Data" and "Weekly Summary"
- Check for hidden sheets
- Ensure file path is correct

### Date Parsing Issues
- Excel dates can be tricky - the parser handles multiple formats
- Check console logs for specific date parsing errors
- Verify Date Stamp column contains actual dates, not text

### Duplicate Serial Numbers
- Current design: UNIQUE constraint on serial_number
- Options: Skip duplicates, update existing, or error
- Recommendation: Update existing records on re-import

### Performance Issues
- For large files (>50MB), consider streaming parser
- Add indexes on frequently queried columns
- Use database pagination, not client-side

---

## 🎯 Success Criteria

**Phase 2 Complete When:**
- ✅ Excel file uploads successfully
- ✅ Units insert into database
- ✅ Import history displays
- ✅ No errors in console

**Phase 3 Complete When:**
- ✅ Dashboard shows correct metrics
- ✅ All filters work
- ✅ Units table displays and is filterable
- ✅ Mobile responsive

**Phase 4 Complete When:**
- ✅ All 3 visualizations render
- ✅ Charts show accurate data
- ✅ Filters apply to charts
- ✅ Performance is acceptable

**Phase 5 Complete When:**
- ✅ Weekly summary displays
- ✅ Delta calculations are accurate
- ✅ Week navigation works
- ✅ Integration with main dashboard works

---

**Ready to start Phase 2? Let me know and I'll create the import API routes and admin page!** 🚀

