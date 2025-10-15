# Amazon Financial Data - Database Integration Plan

## Overview
Convert the Amazon Financial Events API integration from real-time fetching to a database-backed system with intelligent syncing.

## Benefits
- ⚡ **Faster Page Loads**: Query local database instead of waiting for Amazon API
- 📊 **Historical Data**: Preserve data beyond Amazon's retention period
- 🔄 **Delta Syncs**: Only fetch new data after initial import
- 📉 **Reduced API Calls**: Stay within Amazon's rate limits
- 🔍 **Advanced Analytics**: SQL-based querying and aggregation

## Database Schema

### Tables Created
1. **`amazon_financial_sync_log`** - Tracks sync operations
2. **`amazon_financial_events`** - Stores order-level events
3. **`amazon_financial_event_items`** - Stores SKU-level line items

### Views Created
1. **`amazon_sku_performance`** - Aggregated SKU metrics
2. **`amazon_daily_revenue`** - Daily revenue summary

## Implementation Phases

### Phase 1: Database Setup ✅
**Status**: Ready to execute

**Steps**:
1. Run SQL migration: `create-amazon-financial-tables.sql`
2. Verify tables created in Supabase
3. Test RLS policies

**Validation SQL**:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'amazon_financial%';

-- Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename LIKE 'amazon_financial%';
```

---

### Phase 2: Data Parser Enhancement
**Status**: To Do

**Files to Create/Modify**:
- `lib/services/amazon-sp-api/financial-events-parser.ts` (enhance existing)
- Add method to parse raw API data into database-ready objects

**Key Functions**:
```typescript
export class FinancialEventsParser {
  // ... existing methods ...
  
  // NEW: Parse raw events into DB format
  static parseForDatabase(transactions: any[]): {
    events: DatabaseEvent[];
    items: DatabaseEventItem[];
  }
}
```

---

### Phase 3: Database Service Layer
**Status**: To Do

**Files to Create**:
- `lib/services/amazon-financial-db.ts`

**Key Functions**:
```typescript
export class AmazonFinancialDB {
  // Sync operations
  static async createSyncLog(data: SyncLogData): Promise<string>
  static async updateSyncLog(id: string, data: Partial<SyncLogData>): Promise<void>
  
  // Data operations
  static async upsertEvents(events: DatabaseEvent[]): Promise<number>
  static async upsertEventItems(items: DatabaseEventItem[]): Promise<number>
  
  // Query operations
  static async getDateRange(): Promise<{ earliest: Date, latest: Date }>
  static async getSKUPerformance(startDate?: Date, endDate?: Date): Promise<SKUPerformance[]>
  static async getDailySummary(startDate: Date, endDate: Date): Promise<DailySummary[]>
  
  // Gap detection
  static async findMissingDateRanges(): Promise<DateRange[]>
}
```

---

### Phase 4: Sync API Route
**Status**: To Do

**Files to Create/Modify**:
- `app/api/amazon/financial-sync/route.ts` (new)
- Modify: `app/api/amazon/financial-data/route.ts`

**Sync Logic**:
```typescript
POST /api/amazon/financial-sync
{
  syncType: 'full' | 'delta' | 'backfill',
  startDate?: string,
  endDate?: string
}

// Response
{
  success: true,
  syncLogId: string,
  eventsCreated: number,
  itemsCreated: number,
  durationSeconds: number
}
```

**Delta Sync Strategy**:
1. Get latest `posted_date` from database
2. Fetch from Amazon starting from that date
3. Upsert new/changed records
4. Log sync operation

---

### Phase 5: Update Financial Data Route
**Status**: To Do

**Modify**: `app/api/amazon/financial-data/route.ts`

**New Logic**:
```typescript
// Current: Always fetch from Amazon
// New: Check database first

1. Check if date range exists in DB
2. If exists and recent (< 24 hours old):
   - Return from DB
3. If missing or stale:
   - Trigger sync
   - Return from DB
4. Add query param: ?forceRefresh=true to bypass cache
```

---

### Phase 6: Frontend Updates
**Status**: To Do

**Modify**: `app/(dashboard)/admin/amazon-data/financial/page.tsx`

**New Features**:
1. **Sync Status Indicator**
   - Show last sync time
   - Show data coverage (earliest to latest date in DB)
   
2. **Sync Controls**
   - "Sync Now" button (delta sync)
   - "Backfill Historical Data" option
   - Progress indicator during sync

3. **Data Freshness Badge**
   - "Live" - less than 24 hours old
   - "Recent" - less than 7 days old
   - "Stale" - older than 7 days

4. **Gap Detection**
   - Show missing date ranges
   - One-click backfill button

---

### Phase 7: Background Sync (Optional)
**Status**: Future Enhancement

**Implementation Options**:
1. **Vercel Cron Jobs**
   - Create: `app/api/cron/amazon-financial-sync/route.ts`
   - Add to `vercel.json`:
   ```json
   {
     "crons": [{
       "path": "/api/cron/amazon-financial-sync",
       "schedule": "0 */6 * * *"
     }]
   }
   ```

2. **Supabase Edge Functions**
   - Trigger via pg_cron
   - Call sync API endpoint

---

## Migration Strategy

### For Existing Data
1. **Initial Sync**: Run full historical sync for last 180 days (Amazon's limit)
2. **Validation**: Compare DB totals with API totals
3. **Switch**: Update frontend to use DB-backed endpoint
4. **Monitor**: Watch for gaps or inconsistencies

### Rollback Plan
- Keep existing API-direct route as fallback
- Add feature flag: `USE_FINANCIAL_DB`
- Can switch back anytime by toggling flag

---

## Testing Checklist

### Database Tests
- [ ] Tables created successfully
- [ ] RLS policies work (BDI can access, others cannot)
- [ ] Views return correct data
- [ ] Indexes improve query performance

### Sync Tests
- [ ] Full sync imports all data correctly
- [ ] Delta sync only fetches new records
- [ ] Backfill fills missing date ranges
- [ ] Error handling logs failures properly

### API Tests
- [ ] Financial data route returns DB data
- [ ] Date range filtering works
- [ ] SKU filtering works
- [ ] Export includes all DB data

### Frontend Tests
- [ ] Page loads faster with DB data
- [ ] Sync button triggers sync correctly
- [ ] Progress indicators work
- [ ] Data freshness badges accurate

---

## Performance Metrics

### Before (API Direct)
- Load time: ~10 seconds (for 30 days)
- API calls: Every page load
- Data limit: 180 days retention

### After (DB Backed)
- Load time: <1 second (from DB)
- API calls: Only during sync (once per day)
- Data limit: Unlimited historical retention

---

## Maintenance

### Daily Tasks (Automated)
- Delta sync every 6 hours
- Check for gaps in data

### Weekly Tasks
- Review sync logs for errors
- Verify data consistency

### Monthly Tasks
- Analyze storage growth
- Optimize indexes if needed
- Archive old sync logs (keep 90 days)

---

## Next Steps

1. **Run the SQL migration** (Phase 1)
2. **Test table access** in Supabase dashboard
3. **Implement Phase 2-3** (Parser + DB Service)
4. **Create sync endpoint** (Phase 4)
5. **Test with small date range** first
6. **Full historical backfill** once validated
7. **Update frontend** (Phase 6)

---

## Estimated Timeline

- Phase 1: 5 minutes (run SQL)
- Phase 2-3: 1-2 hours (parser + DB service)
- Phase 4: 1 hour (sync API)
- Phase 5: 30 minutes (update existing route)
- Phase 6: 1-2 hours (frontend updates)
- Testing: 1 hour

**Total**: ~6-8 hours for full implementation

---

## Questions to Answer

1. **How far back to initially sync?**
   - Recommendation: 180 days (Amazon's max retention)
   
2. **How often to run delta syncs?**
   - Recommendation: Every 6 hours (4x daily)
   
3. **When to trigger manual sync?**
   - User clicks "Refresh" button
   - Data is older than 24 hours
   
4. **How to handle Amazon API rate limits?**
   - Current implementation has exponential backoff
   - Sync operations are async, won't block UI

---

## Success Criteria

✅ Page loads in under 1 second  
✅ No data loss compared to API direct  
✅ Can query historical data beyond 180 days  
✅ Sync operations complete successfully  
✅ Export includes all historical data  
✅ No increase in Amazon API errors/throttling  

