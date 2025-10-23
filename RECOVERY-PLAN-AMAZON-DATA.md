# Amazon Financial Data Recovery Plan

## Problem
The "Sync to Amazon" button created duplicate records (separate sale + refund transactions) instead of net transactions, causing the 1,9,1,9 pattern in exports.

## Recovery Steps

### Step 1: Check what will be deleted
Run the first queries in `delete-corrupted-amazon-data.sql` to see how many records will be affected:

```sql
-- This shows you what will be deleted
SELECT 
    'amazon_financial_transactions' as table_name,
    COUNT(*) as records_to_delete,
    MIN(posted_date) as earliest_date,
    MAX(posted_date) as latest_date
FROM amazon_financial_transactions
WHERE posted_date >= '2025-08-01'
  AND posted_date <= NOW();
```

### Step 2: Delete corrupted data (Aug 1, 2025 - Today)
Once you confirm the counts look right, uncomment and run the DELETE statements in `delete-corrupted-amazon-data.sql`:

```sql
DELETE FROM amazon_financial_transactions
WHERE posted_date >= '2025-08-01'
  AND posted_date <= NOW();

DELETE FROM amazon_financial_line_items
WHERE posted_date >= '2025-08-01'
  AND posted_date <= NOW();
```

### Step 3: Verify deletion
Run the verification query to confirm the data is gone:

```sql
SELECT 
    COUNT(*) as remaining_records,
    MIN(posted_date) as earliest_date,
    MAX(posted_date) as latest_date
FROM amazon_financial_transactions;
```

### Step 4: Re-download data using the old method
1. Go to **Business → Amazon Data → Financial Data**
2. Use the **"Update"** button (NOT the Sync button - it's now hidden)
3. Select date ranges from Aug 1, 2025 to today
4. Download data in small chunks (30 days at a time recommended)
5. The old method will create proper net transactions

### Step 5: Verify the fix
1. After re-downloading, export the data to Excel
2. Check that the 1,9,1,9 pattern is gone
3. Verify each order has only ONE transaction record (net of sales and refunds)

## What Changed
- ✅ Sync button is now hidden (code kept intact, just commented out)
- ✅ SQL script created to delete corrupted data
- ✅ All sync API code is preserved (in case we need to fix it later)
- ✅ Old "Update" method still works perfectly

## Files Modified
1. `app/(dashboard)/admin/amazon-data/financial/page.tsx` - Sync button commented out
2. `delete-corrupted-amazon-data.sql` - SQL to clean up corrupted data

## Files Preserved (No Changes)
- `app/api/amazon/financial-transactions/sync/route.ts` - Sync API (kept for future fix)
- All other Amazon financial data code

## Next Steps After Recovery
Once data is clean and verified:
1. We can fix the sync logic to create net transactions properly
2. Or just keep using the old Update method (which works fine)
3. Decision is yours!

