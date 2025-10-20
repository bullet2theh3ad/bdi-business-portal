# Amazon Ad Spend Backfill

## Purpose
Fills missing ad spend, credits, and debits data in the `amazon_financial_summaries` table by fetching from the Amazon SP-API in 30-day chunks.

## Why is this needed?
- Ad spend/credits/debits are NOT stored in `amazon_financial_line_items` (only order/refund data is)
- They come from different Amazon API endpoints
- When viewing "All Data" (445+ days), the system can't call the API (180-day limit)
- Result: Ad spend shows $0 for large date ranges ❌

## How it works
1. Scans `amazon_financial_line_items` to find earliest/latest dates (Aug 2024 - Oct 2025)
2. Divides this range into 30-day chunks (within API limit)
3. Checks which chunks are missing summaries in `amazon_financial_summaries`
4. For each missing chunk:
   - Fetches data from Amazon API
   - Calculates summary (ad spend, credits, debits, etc.)
   - Saves to `amazon_financial_summaries` table

## Features
- ✅ Automatically finds gaps
- ✅ Fetches in 30-day chunks (API-safe)
- ✅ Rate limiting (1 second between requests)
- ✅ Idempotent (safe to re-run)
- ✅ Progress tracking
- ✅ Error handling
- ✅ Skips existing summaries (no duplicates)
- ✅ Processes 5 chunks per run (avoids timeout)

## Usage

### ⭐ Recommended: UI Button
1. Go to **Business → Amazon Data → Financial Data**
2. Click the **"Backfill Ad Spend"** button (purple button next to "Update")
3. Confirm the action
4. Wait for completion alert
5. Click "All Data (DB)" to see updated ad spend ✅

The button will process 5 date ranges at a time. If you have more than 5 missing ranges, just click the button again to continue.

### Alternative: API Endpoint
```bash
curl -X POST http://localhost:3000/api/admin/amazon-data/backfill-ad-spend
```

### Alternative: Command Line (Not Recommended)
```bash
# This may fail due to ES module issues
npx ts-node scripts/backfill-ad-spend.ts
```

## Expected Output (UI)
```
✅ Backfill complete!

Processed: 5
Failed: 0
Total: 15

10 ranges remaining. Run again to continue.
```

## After Running
1. The page will auto-refresh
2. Click "All Data (DB)" button
3. Ad spend should now show correct values instead of $0 ✅

## Troubleshooting

### Ad spend still shows $0
- Click the "Backfill Ad Spend" button multiple times until it says "0 ranges remaining"
- Each click processes 5 chunks

### Button says "0 ranges remaining" but ad spend is still $0
- This means all 30-day summaries exist
- The issue is that "All Data" (445 days) doesn't match any single 30-day summary
- This is expected behavior - use the quick date buttons instead (Last 30 Days, Last 90 Days, etc.)

### Error: "Failed to backfill"
- Check the console logs for details
- Common causes:
  - Amazon API rate limit (wait a few minutes)
  - Invalid credentials (check `.env.local`)
  - Network issues

## Database Tables

### amazon_financial_line_items
- Stores per-SKU order/refund line items
- Does NOT include ad spend/credits/debits

### amazon_financial_summaries
- Stores aggregated summaries per date range
- INCLUDES ad spend/credits/debits
- This is what the backfill populates
