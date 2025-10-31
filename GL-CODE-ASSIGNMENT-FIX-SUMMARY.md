# GL Code Assignment - Real QuickBooks Data Fix

## Summary

Fixed the GL Code Assignment page to fetch **real GL codes from QuickBooks** instead of using hardcoded sample data. Now shows ALL your QuickBooks Chart of Accounts.

---

## What Was Changed

### 1. ✅ Frontend: GL Code Assignment Page

**File:** `app/(dashboard)/admin/inventory-analysis/gl-code-assignment/page.tsx`

**Changes:**
- ✅ Now fetches real QuickBooks accounts from `/api/quickbooks/accounts`
- ✅ Fetches and merges user-defined category assignments
- ✅ Displays full account details: Account Number, Name, Type, Classification
- ✅ Shows hierarchical account names (Fully Qualified Name)
- ✅ Refresh button now actually syncs from QuickBooks
- ✅ Save button saves assignments to database
- ✅ Added error handling and loading states
- ✅ Uses `qbAccountId` as the unique identifier (instead of account code)

**Before:**
- 14 hardcoded sample accounts
- No real QuickBooks data
- Changes not saved

**After:**
- ALL QuickBooks accounts from your Chart of Accounts
- Real-time sync from QuickBooks
- Assignments saved to database
- Persists between sessions

---

### 2. ✅ Backend: API Endpoints

**File:** `app/api/gl-code-assignments/route.ts` (NEW)

**Endpoints Created:**

#### `GET /api/gl-code-assignments`
- Fetches all saved GL code category assignments
- Returns: Array of assignments with qbAccountId, category, includeInCashFlow

#### `POST /api/gl-code-assignments`
- Saves GL code category assignments (bulk upsert)
- Body: `{ assignments: [{ qbAccountId, category, includeInCashFlow }] }`
- Uses upsert to update existing or create new assignments

**Features:**
- ✅ Authentication required
- ✅ QuickBooks feature flag check
- ✅ Input validation
- ✅ Bulk save/update

---

### 3. ✅ Database: GL Code Assignments Table

**File:** `create-gl-code-assignments-table.sql` (NEW)

**Table:** `gl_code_assignments`

**Schema:**
```sql
CREATE TABLE gl_code_assignments (
  id UUID PRIMARY KEY,
  qb_account_id TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'unassigned',
  include_in_cash_flow BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Categories:**
- `opex` - Operating Expenses (Rent, Utilities, Salaries, etc.)
- `cogs` - Cost of Goods Sold
- `inventory` - Inventory Asset Accounts
- `nre` - Non-Recurring Engineering Expenses
- `ignore` - Accounts to exclude (Depreciation, Interest, etc.)
- `unassigned` - Not yet categorized

**Features:**
- ✅ Unique constraint on `qb_account_id`
- ✅ Indexes for fast lookups
- ✅ Auto-update `updated_at` timestamp
- ✅ Category validation constraint

---

## How to Deploy

### Step 1: Run Database Migration

```bash
# Connect to your database and run the SQL file
psql -h <your-db-host> -U <your-db-user> -d <your-db-name> -f create-gl-code-assignments-table.sql
```

Or run the SQL manually in your database client.

### Step 2: Verify QuickBooks Sync

1. Make sure you have QuickBooks connected
2. Go to **Admin → QuickBooks Integration**
3. Click **"Sync Now"** to ensure accounts are in the database

### Step 3: Test the GL Code Assignment Page

1. Go to **Admin → Business Analysis → Cash Flow Analysis**
2. Click **"Go to Setup"** for GL Code Assignment
3. You should now see **ALL your QuickBooks accounts**
4. Try:
   - Assigning categories to accounts
   - Toggling "Include in Cash Flow"
   - Clicking "Save Mappings"
   - Clicking "Refresh from QuickBooks"

---

## How to Use

### Categorize Your GL Codes

1. **Go to GL Code Assignment Page:**
   - Admin → Inventory Analysis → GL Code Assignment
   - OR: Admin → Business Analysis → Cash Flow → Step 2

2. **Review Your Accounts:**
   - All QuickBooks accounts are loaded
   - Shows: Account Number, Name, Type, Classification
   - Filter by category or search

3. **Assign Categories:**
   - For each account, select appropriate category:
     - **OpEx**: Operating expenses (affects cash flow)
     - **COGS**: Cost of goods sold
     - **Inventory**: Inventory asset accounts
     - **NRE**: Non-recurring engineering
     - **Ignore**: Exclude from cash flow analysis
     - **Unassigned**: Not yet categorized

4. **Set Cash Flow Inclusion:**
   - Toggle "Included" / "Excluded" for each account
   - Included accounts affect cash flow calculations
   - Excluded accounts are tracked but don't impact cash flow

5. **Save Your Work:**
   - Click **"Save Mappings"** to persist changes
   - Assignments are saved to database
   - Reload the page to verify persistence

6. **Refresh from QuickBooks:**
   - Click **"Refresh from QuickBooks"** to sync new accounts
   - Pulls latest Chart of Accounts from QB
   - Preserves your existing category assignments

---

## Examples

### Example Assignment Strategy

**Operating Expenses (OpEx):**
- 6000 - Rent Expense → `opex`, included
- 6100 - Utilities → `opex`, included
- 6200 - Salaries & Wages → `opex`, included
- 6300 - Marketing & Advertising → `opex`, included

**Cost of Goods Sold (COGS):**
- 5000 - Cost of Goods Sold → `cogs`, included
- 5100 - Direct Labor → `cogs`, included
- 5200 - Manufacturing Supplies → `cogs`, included

**Inventory:**
- 1200 - Inventory → `inventory`, excluded (asset, not expense)

**NRE (Non-Recurring Engineering):**
- 7000 - Equipment Purchases → `nre`, excluded (capital expense)
- 7100 - R&D Expenses → `nre`, included (if tracking separately)

**Ignore:**
- 8000 - Depreciation → `ignore`, excluded (non-cash)
- 9000 - Interest Income → `ignore`, excluded (not operational)
- 4000 - Sales Revenue → `ignore`, excluded (income, not expense)

---

## Benefits

### Before the Fix
- ❌ Only 14 hardcoded sample accounts
- ❌ No real QuickBooks data
- ❌ Assignments not saved
- ❌ Had to manually track GL codes elsewhere

### After the Fix
- ✅ ALL QuickBooks accounts displayed
- ✅ Real-time sync from QuickBooks
- ✅ Assignments saved to database
- ✅ Persistent across sessions
- ✅ Ready for cash flow analysis
- ✅ Categorize once, use everywhere
- ✅ Foundation for automated reporting

---

## Next Steps (Future Features)

Once GL codes are categorized, you can:

1. **Cash Flow Dashboard** (Coming Soon)
   - Automated cash flow statements
   - OpEx vs COGS breakdown
   - Monthly/quarterly trends
   - Category-based analysis

2. **Budget Tracking**
   - Compare actual vs budget by category
   - Track OpEx over time
   - Identify cost optimization opportunities

3. **Financial Reports**
   - P&L by category
   - Cash flow projections
   - Expense allocation analysis

---

## Files Created/Modified

### Modified
1. `app/(dashboard)/admin/inventory-analysis/gl-code-assignment/page.tsx`
   - Fetch real QuickBooks data
   - Save/load assignments
   - Enhanced UI

### Created
1. `app/api/gl-code-assignments/route.ts`
   - GET: Fetch assignments
   - POST: Save assignments

2. `create-gl-code-assignments-table.sql`
   - Database schema
   - Indexes and constraints

3. `GL-CODE-ASSIGNMENT-FIX-SUMMARY.md` (this file)
   - Documentation

---

## Testing Checklist

- [ ] Run database migration
- [ ] Verify QuickBooks connection active
- [ ] Load GL Code Assignment page
- [ ] Verify all QB accounts are displayed
- [ ] Assign category to a few accounts
- [ ] Toggle cash flow inclusion
- [ ] Click "Save Mappings"
- [ ] Reload page and verify assignments persist
- [ ] Click "Refresh from QuickBooks"
- [ ] Export CSV and verify data

---

## Support

If you encounter issues:

1. **No accounts showing:**
   - Check QuickBooks connection
   - Run QuickBooks sync
   - Check browser console for errors

2. **Save not working:**
   - Check network tab for API errors
   - Verify database migration ran successfully
   - Check server logs

3. **Assignments not persisting:**
   - Verify database table exists
   - Check API endpoint permissions
   - Ensure feature flag is enabled for your user

---

## Summary

Your GL Code Assignment page now:
- ✅ Fetches **real QuickBooks Chart of Accounts**
- ✅ Shows **ALL your GL codes** (not just 14 samples)
- ✅ **Saves assignments** to database
- ✅ **Persists** between sessions
- ✅ Ready for **cash flow analysis**

You can now categorize all your QuickBooks accounts and use those categorizations for automated financial analysis and reporting! 🎉

