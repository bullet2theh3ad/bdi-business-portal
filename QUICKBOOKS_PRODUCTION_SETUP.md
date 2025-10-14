# 🚀 QuickBooks Production Setup & Delta Sync Guide

## 📋 Step 1: Switch from Sandbox to Production

### **In QuickBooks Developer Portal:**
1. Go to: https://developer.intuit.com/app/developer/dashboard
2. Select your app
3. Find **Production Keys** (not Sandbox Keys)
4. Copy:
   - **Production Client ID**
   - **Production Client Secret**

### **Update Your `.env.local` File:**
```bash
# Replace these with Production values:
QUICKBOOKS_CLIENT_ID=your_production_client_id_here
QUICKBOOKS_CLIENT_SECRET=your_production_client_secret_here

# Set environment to production:
QUICKBOOKS_ENVIRONMENT=production

# Redirect URI stays the same:
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/quickbooks/callback
```

### **Update Redirect URIs in QB Portal:**
Add these redirect URIs in your QuickBooks app settings:
- `http://localhost:3000/api/quickbooks/callback` (for local testing)
- `https://bdibusinessportal.com/api/quickbooks/callback` (for production)

---

## 🔄 Step 2: Connect to Your REAL Company

1. Restart your dev server (if running)
2. Go to **QuickBooks Dashboard** in your app
3. If connected to sandbox, click **"Disconnect"**
4. Click **"Connect to QuickBooks"**
5. **IMPORTANT**: Select your **REAL company** (not sandbox)
6. Authorize the connection

---

## ⚡ Step 3: Understanding Delta Sync

### **What is Delta Sync?**
Delta Sync is a **smart sync** that only fetches records that have **changed** since your last sync. This is much faster and more efficient than re-importing all data every time.

### **How It Works:**

#### **First Sync (Full Sync):**
- When you connect for the first time, there's no `last_sync_at` timestamp
- The system automatically performs a **Full Sync**
- Fetches **ALL historical data** from day 1 to present
- After completion, stores the sync timestamp in `last_sync_at`

#### **Subsequent Syncs (Delta Sync):**
- Default button: **"⚡ Sync Now (Delta)"**
- Only fetches records modified after `last_sync_at`
- Uses QuickBooks query: `WHERE Metadata.LastUpdatedTime > 'last_sync_timestamp'`
- Much faster (seconds instead of minutes)
- Only syncs what changed

#### **Manual Full Sync:**
- Button: **"🔄 Full Sync (All Data)"**
- Use this if:
  - You suspect data is out of sync
  - You want to re-import everything
  - You're troubleshooting issues
- Re-fetches all data from day 1

---

## 🎯 Step 4: Sync Your Real Data

### **Initial Full Sync:**
1. Go to **QuickBooks Dashboard**
2. Click **"⚡ Sync Now (Delta)"** (it will automatically do a full sync on first run)
3. Wait for completion (may take 1-5 minutes depending on data volume)
4. Review the sync summary alert

### **Expected First Sync Results:**
```
🔄 FULL SYNC completed! Synced X records.

Customers: 150
Invoices: 523
Vendors: 45
Expenses: 342
Items/Products: 89
Payments: 412
Bills: 78
Sales Receipts: 67
Credit Memos: 12
Purchase Orders: 34

✅ Next sync will automatically use Delta Sync (only changed records)
```

### **After First Sync:**
- The dashboard will show: **"Last Synced: [timestamp] ✓ success"**
- Message: **"⚡ Next sync will use Delta mode (only changed records)"**
- From now on, clicking **"⚡ Sync Now (Delta)"** will only fetch changed records

---

## 📊 Step 5: Delta Sync in Action

### **How to Use Delta Sync:**
1. Click **"⚡ Sync Now (Delta)"** anytime
2. Only changed/new records are fetched
3. Typically completes in seconds
4. Updates `last_sync_at` timestamp after completion

### **Delta Sync Query Examples:**
```sql
-- Customers
SELECT * FROM Customer WHERE Metadata.LastUpdatedTime > '2024-10-14T10:30:00-08:00'

-- Invoices
SELECT * FROM Invoice WHERE Metadata.LastUpdatedTime > '2024-10-14T10:30:00-08:00'

-- Expenses
SELECT * FROM Purchase WHERE PaymentType = 'Cash' AND Metadata.LastUpdatedTime > '2024-10-14T10:30:00-08:00'
```

### **What Gets Synced in Delta Mode:**
- ✅ New records created since last sync
- ✅ Updated records modified since last sync
- ✅ Changes to existing records (amounts, status, etc.)
- ❌ Unchanged records (skipped)

---

## 🔍 Step 6: Verify Your Data

After first sync, verify your data is correct:

1. **QuickBooks Dashboard**
   - Check stat cards for correct counts
   - Verify numbers match QuickBooks Online

2. **QuickBooks → Products**
   - Review your Products/Items list
   - Check names, SKUs, prices

3. **QuickBooks → Reports → Overview**
   - Review the Master Financial Dashboard
   - Verify revenue, expenses, AR, AP match

4. **Run a Test Delta Sync**
   - Make a change in QuickBooks (update an invoice)
   - Click **"⚡ Sync Now (Delta)"**
   - Should only fetch 1-2 records
   - Verify the change appears in your app

---

## ⚙️ Technical Details

### **Database Schema:**
- `quickbooks_connections.last_sync_at` - Stores the last successful sync timestamp
- Used as the baseline for delta queries

### **Sync Types:**
- **`delta`** - Smart sync (default, recommended)
- **`full`** - Re-import all data (manual override)

### **API Implementation:**
```typescript
// Delta sync (default)
POST /api/quickbooks/sync
{ syncMode: 'delta' }

// Full sync (manual)
POST /api/quickbooks/sync
{ syncMode: 'full' }
```

### **QuickBooks API Limits:**
- Max 1000 records per query
- Automatic pagination implemented
- Delta sync respects these limits

---

## 🚨 Troubleshooting

### **Problem: First sync shows 0 records**
**Solution**: Your QuickBooks company might be empty. Add test data in QuickBooks Online first.

### **Problem: Delta sync isn't working**
**Solution**: Check that `last_sync_at` is set in `quickbooks_connections` table:
```sql
SELECT last_sync_at FROM quickbooks_connections WHERE is_active = true;
```

### **Problem: Missing recent changes**
**Solution**: 
1. Click **"🔄 Full Sync (All Data)"**
2. This will reset the baseline
3. Future delta syncs will work correctly

### **Problem: Token expired**
**Solution**:
1. Dashboard will show a warning
2. Click **"Reconnect Now"**
3. Re-authorize with QuickBooks

---

## ✅ Next Steps: BDI Integration

Now that you have **real QuickBooks data**, you can:
1. Review your Products/Items
2. Map QB Products to BDI SKUs
3. Build the integration dashboard
4. Show BDI inventory with QB financial data

---

## 📝 Summary

✅ **You now have:**
- Delta sync automatically enabled
- First sync = Full (all data from day 1)
- Subsequent syncs = Delta (only changes)
- Two buttons: Delta (smart) and Full (re-import)
- Last sync timestamp tracking
- Production-ready QuickBooks integration

✅ **Best Practices:**
- Use **Delta Sync** for daily operations
- Use **Full Sync** only when needed
- Run sync after making bulk changes in QB
- Monitor sync logs for issues
- Keep your QuickBooks connection active

---

**Ready to map QuickBooks Products to BDI SKUs!** 🚀

