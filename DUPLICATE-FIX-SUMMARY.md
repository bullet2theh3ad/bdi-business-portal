# Amazon Financial Data - Duplicate Fix Summary

## Problem Identified

The **Amazon financial data for September 2025** (and potentially other months) contains **duplicate records** in the Excel export.

### Root Cause

The `/api/amazon/financial-data` route (used by the **"Update" button** on the Financial Data page) was inserting line items into the database **without checking for duplicates**.

Every time you clicked "Update" for the same date range (e.g., September 1-30), it would:
1. Fetch data from Amazon SP-API ✅
2. Insert ALL line items into the database ❌ (even if they already existed)
3. Result: Multiple copies of the same transactions

### Why This Happened

The codebase has TWO different import routes:
1. **`/api/amazon/financial-data`** (Update button) - ❌ **NO duplicate checking**
2. **`/api/amazon/financial-transactions/sync`** (Sync button) - ✅ **HAS duplicate checking**

You were using the "Update" button, which didn't have deduplication logic.

---

## What Was Fixed

### ✅ Code Fix Applied

Updated `/app/api/amazon/financial-data/route.ts` (lines 589-643) to add deduplication logic:

**Before:**
```typescript
// Save to database in batches
if (lineItemsToSave.length > 0) {
  // ... directly inserts without checking
  await db.insert(amazonFinancialLineItems).values(batch);
}
```

**After:**
```typescript
// Save to database in batches (with deduplication)
if (lineItemsToSave.length > 0) {
  // Check for existing records
  const existingRecords = await db
    .select({...})
    .from(amazonFinancialLineItems)
    .where(...date range...);
  
  // Create Set of unique keys: orderId_postedDate_amazonSku
  const existingKeys = new Set(
    existingRecords.map(r => 
      `${r.orderId}_${r.postedDate?.toISOString()}_${r.amazonSku}`
    )
  );
  
  // Filter out duplicates
  const newRecordsOnly = lineItemsToSave.filter(item => {
    const key = `${item.orderId}_${item.postedDate?.toISOString()}_${item.amazonSku}`;
    return !existingKeys.has(key);
  });
  
  // Insert only NEW records
  await db.insert(amazonFinancialLineItems).values(newRecordsOnly);
}
```

**Deduplication Key:** `order_id + posted_date + amazon_sku`

This ensures that each unique transaction line item is only stored once in the database.

---

## How to Clean Up Existing Duplicates

### Step 1: Run Diagnostic Queries

Use the new SQL script: **`cleanup-duplicate-amazon-line-items-UPDATED.sql`**

First, run **Steps 1-3** to see how many duplicates you have:

```sql
-- Step 1: Count duplicates
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT (order_id, amazon_sku, posted_date)) as unique_records,
  COUNT(*) - COUNT(DISTINCT (order_id, amazon_sku, posted_date)) as duplicate_count
FROM amazon_financial_line_items;

-- Step 2: See top 20 duplicate examples
SELECT 
  order_id,
  amazon_sku,
  TO_CHAR(posted_date, 'YYYY-MM-DD HH24:MI:SS') as posted_datetime,
  COUNT(*) as duplicate_count
FROM amazon_financial_line_items
GROUP BY order_id, amazon_sku, posted_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 20;
```

### Step 2: Create Temporary Deduplicated Table

Run **Step 4** to create a temporary table with only unique records:

```sql
CREATE TEMP TABLE deduplicated_line_items AS
SELECT DISTINCT ON (order_id, amazon_sku, posted_date)
  id, order_id, posted_date, transaction_type, amazon_sku, ...
FROM amazon_financial_line_items
ORDER BY order_id, amazon_sku, posted_date, id;
```

This keeps the **first record** (lowest `id`) for each unique combination.

### Step 3: Verify Before Deletion

Run **Step 5** to see how many records will be removed:

```sql
SELECT 
  COUNT(*) as deduplicated_count,
  (SELECT COUNT(*) FROM amazon_financial_line_items) as original_count,
  (SELECT COUNT(*) FROM amazon_financial_line_items) - COUNT(*) as records_to_remove
FROM deduplicated_line_items;
```

### Step 4: Delete Duplicates

⚠️ **IMPORTANT:** Make a database backup first!

Once you're confident, uncomment and run **Step 6**:

```sql
DELETE FROM amazon_financial_line_items 
WHERE id NOT IN (SELECT id FROM deduplicated_line_items);
```

### Step 5: Verify Cleanup

Run **Step 7** to confirm no duplicates remain:

```sql
SELECT 
  COUNT(*) as total_records_after_cleanup,
  COUNT(DISTINCT (order_id, amazon_sku, posted_date)) as unique_records_after_cleanup,
  COUNT(*) - COUNT(DISTINCT (order_id, amazon_sku, posted_date)) as remaining_duplicates
FROM amazon_financial_line_items;
```

Expected result: `remaining_duplicates = 0`

### Step 6: Check September Data

Run **Steps 8-9** to verify September 2025 looks correct:

```sql
SELECT 
  order_id,
  amazon_sku,
  bdi_sku,
  TO_CHAR(posted_date, 'YYYY-MM-DD') as posted_date,
  quantity,
  gross_revenue
FROM amazon_financial_line_items
WHERE posted_date >= '2025-09-01' AND posted_date < '2025-10-01'
ORDER BY posted_date DESC
LIMIT 30;
```

---

## Testing the Fix

### After Running the Cleanup SQL:

1. Go to **Admin → Amazon Data → Financial Data**
2. Set date range to **September 1-30, 2025**
3. Click **"Update"** button
4. Wait for the data to load
5. Click **"Export to Excel"**
6. Open the Excel file and check the **"Transaction Details"** tab
7. ✅ **You should see NO duplicates** (each order should appear only once per SKU)

### Test the Deduplication Logic:

1. In the Financial Data page, click **"Update"** again for September (same date range)
2. Check the browser console (F12 → Console)
3. You should see a message like:
   ```
   [Financial Data] ⚠️ Skipped XX duplicate records (already in database)
   [Financial Data] 📊 0 new records to insert
   ```
4. This confirms the deduplication is working!

---

## Files Changed

1. ✅ **`app/api/amazon/financial-data/route.ts`** - Added deduplication logic
2. ✅ **`cleanup-duplicate-amazon-line-items-UPDATED.sql`** - New cleanup script (uses `amazon_sku` as key)

## Files to Keep

- **`cleanup-duplicate-amazon-line-items.sql`** (old version, uses `bdi_sku`) - Can be archived/deleted
- **`RECOVERY-PLAN-AMAZON-DATA.md`** - Still relevant for historical context
- **`delete-corrupted-amazon-data.sql`** - Still useful for bulk date range deletions

---

## Summary

### What You Need to Do:

1. ✅ **Code fix is already applied** (no action needed)
2. ⏳ **Run the cleanup SQL script** to remove existing duplicates from the database
3. ✅ **Test the fix** by clicking "Update" for September again (should skip duplicates)
4. 🎉 **Export to Excel** and verify no duplicates appear

### Expected Results:

- ✅ No more duplicates in Excel exports
- ✅ Clicking "Update" multiple times for the same date range is safe
- ✅ Database only stores unique transaction line items

---

## Questions?

If you have any questions or encounter issues:

1. Check the browser console for API logs (shows "Skipped X duplicates")
2. Check server logs for detailed import information
3. The deduplication key is: `order_id + posted_date + amazon_sku`

The fix is **backward compatible** - it will work with both new and existing data in the database.

