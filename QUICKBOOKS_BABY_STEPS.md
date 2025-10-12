# 🚀 QuickBooks Integration: Baby Steps Implementation Plan

## ✅ What's Been Set Up (Phase 1 - Complete)

### 1. Feature Flag System
- ✅ Created `lib/feature-flags.ts` with email-based whitelist
- ✅ Only `scistulli@boundlessdevices.com` can see QuickBooks menu
- ✅ Easy to add more users by editing `QUICKBOOKS_WHITELIST` array

### 2. Database Schema
- ✅ Created `create-quickbooks-integration.sql` with 6 tables:
  - `quickbooks_connections` - OAuth tokens & company info
  - `quickbooks_sync_log` - Audit trail of all syncs
  - `quickbooks_customers` - Customer data from QB
  - `quickbooks_invoices` - Invoice data from QB
  - `quickbooks_vendors` - Vendor data from QB
  - `quickbooks_expenses` - Expense/bill data from QB
- ✅ Row Level Security (RLS) - Only super admins can access
- ✅ Indexes for performance
- ✅ Helper functions for token refresh

### 3. Admin UI Page
- ✅ Created `/admin/quickbooks` page with:
  - Connection status display
  - "Connect to QuickBooks" button
  - Sync statistics cards
  - Disconnect functionality
  - Manual sync trigger
  - Setup instructions

### 4. API Routes (Placeholder)
- ✅ `/api/quickbooks/connection` - Get connection status
- ✅ `/api/quickbooks/stats` - Get sync statistics
- ✅ `/api/quickbooks/auth` - OAuth authorization (shows setup guide)
- ✅ `/api/quickbooks/disconnect` - Disconnect QB account
- ✅ `/api/quickbooks/sync` - Manual data sync (placeholder)

### 5. Sidebar Integration
- ✅ Added "💰 QuickBooks" menu item under Admin
- ✅ Only visible to whitelisted users
- ✅ Feature flag check on every page load

### 6. Documentation
- ✅ `QUICKBOOKS_INTEGRATION_GUIDE.md` - Complete setup guide
- ✅ `QUICKBOOKS_BABY_STEPS.md` - This file!

---

## 🏃 Baby Steps: Local Development First

### Phase 1: Local Setup (DO THIS FIRST)

#### Step 1.1: Run Database Migration (LOCAL)
```bash
# Connect to your LOCAL Supabase instance
# Or use Supabase CLI
supabase db push

# OR run the SQL file manually
psql <your-local-database-url> -f create-quickbooks-integration.sql
```

#### Step 1.2: Create QuickBooks Sandbox App
1. Go to https://developer.intuit.com/
2. Sign in with your Intuit account
3. Click "Create an app"
4. Choose "QuickBooks Online API"
5. Fill in:
   - **App Name**: BDI Portal Dev
   - **Description**: Internal testing
   - **Category**: Business Management

#### Step 1.3: Configure OAuth (SANDBOX)
1. In app dashboard → "Keys & OAuth"
2. Set Redirect URI: `http://localhost:3001/api/quickbooks/callback`
3. Copy your **Client ID** and **Client Secret**

#### Step 1.4: Add Environment Variables (LOCAL)
Add to your `.env.local`:

```env
# QuickBooks OAuth (SANDBOX - Local Dev Only)
QUICKBOOKS_CLIENT_ID=ABxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
QUICKBOOKS_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxx
QUICKBOOKS_REDIRECT_URI=http://localhost:3001/api/quickbooks/callback

# QuickBooks API Environment
QUICKBOOKS_ENVIRONMENT=sandbox
QUICKBOOKS_API_BASE_URL=https://sandbox-quickbooks.api.intuit.com
```

#### Step 1.5: Install Dependencies (LOCAL)
```bash
pnpm add intuit-oauth node-quickbooks
pnpm add -D @types/node-quickbooks
```

#### Step 1.6: Test Local Access
1. Start dev server: `pnpm dev`
2. Visit: http://localhost:3001/admin/quickbooks
3. You should see the QuickBooks dashboard (Steve only)
4. Click "Connect to QuickBooks"
5. Verify you see setup instructions (not an error)

---

### Phase 2: Implement OAuth Flow (LOCAL ONLY)

#### Step 2.1: Create OAuth Callback Route
Create `/app/api/quickbooks/callback/route.ts` to handle OAuth redirect

#### Step 2.2: Update Auth Route
Implement actual OAuth redirect in `/api/quickbooks/auth/route.ts`

#### Step 2.3: Test OAuth Flow (LOCAL)
1. Click "Connect to QuickBooks" on dashboard
2. Login to QuickBooks Sandbox
3. Authorize the app
4. Verify token storage in `quickbooks_connections` table
5. Check connection status updates on dashboard

---

### Phase 3: Implement Data Sync (LOCAL ONLY)

#### Step 3.1: Implement Customer Sync
Update `/api/quickbooks/sync/route.ts`:
- Fetch customers from QB API
- Upsert to `quickbooks_customers` table
- Update sync log

#### Step 3.2: Implement Invoice Sync
- Fetch invoices from QB API
- Match with customers
- Upsert to `quickbooks_invoices` table

#### Step 3.3: Test Manual Sync (LOCAL)
1. Click "Sync Now" button
2. Verify data appears in database
3. Check sync statistics update
4. Verify sync log entries

---

### Phase 4: Add Reporting (LOCAL ONLY)

#### Step 4.1: Create Reports Page
Create `/admin/quickbooks/reports` with:
- Customer list from QB
- Invoice aging report
- Vendor spending report
- Expense breakdown by category

#### Step 4.2: Integrate with Existing Reports
- Add QB invoice data to CPFR invoice reports
- Match QB customers with shipment customers
- Show QB expense data in NRE Budget comparison

---

### Phase 5: Production Deployment (CAREFUL!)

#### Step 5.1: Create Production QB App
1. Create NEW app in QuickBooks Developer Portal
2. Use production credentials (not sandbox)
3. Set Redirect URI: `https://bdibusinessportal.com/api/quickbooks/callback`

#### Step 5.2: Add Production Environment Variables
Add to **Vercel** environment variables (NOT `.env.local`):

```env
# QuickBooks OAuth (PRODUCTION)
QUICKBOOKS_CLIENT_ID=<production-client-id>
QUICKBOOKS_CLIENT_SECRET=<production-client-secret>
QUICKBOOKS_REDIRECT_URI=https://bdibusinessportal.com/api/quickbooks/callback

# QuickBooks API Environment
QUICKBOOKS_ENVIRONMENT=production
QUICKBOOKS_API_BASE_URL=https://quickbooks.api.intuit.com
```

#### Step 5.3: Run Database Migration (PRODUCTION)
```bash
# Connect to PRODUCTION Supabase
supabase link --project-ref <your-project-ref>
supabase db push
```

#### Step 5.4: Deploy to Production
```bash
git add .
git commit -m "Add QuickBooks integration (Steve only)"
git push origin main
```

#### Step 5.5: Test in Production (STEVE ONLY)
1. Visit: https://bdibusinessportal.com/admin/quickbooks
2. Connect to REAL QuickBooks account
3. Test sync with REAL data
4. Verify reports work correctly

---

### Phase 6: Gradual Rollout

#### Step 6.1: Add Dena (CFO)
Edit `lib/feature-flags.ts`:
```typescript
export const QUICKBOOKS_WHITELIST = [
  'scistulli@boundlessdevices.com',
  'dzand@boundlessdevices.com', // ✅ ADD THIS
];
```

#### Step 6.2: Monitor for Issues
- Check sync logs for errors
- Review Supabase logs
- Monitor performance

#### Step 6.3: Add More Users (Gradual)
Continue adding emails one-by-one to whitelist

#### Step 6.4: Remove Feature Flag (Optional)
Once stable, remove `requiresFeatureFlag` from Sidebar menu item

---

## 🔒 Security Checklist

- ✅ Feature flag restricts access by email
- ✅ RLS policies limit database access to super admins
- ✅ OAuth tokens never sent to client
- ✅ API routes check authentication
- ✅ Sandbox environment for testing
- ⚠️ **TODO**: Encrypt tokens at rest (production)
- ⚠️ **TODO**: Implement token refresh logic
- ⚠️ **TODO**: Add audit logging for all QB operations

---

## 📊 What Can You Do With This?

Once fully implemented, you'll be able to:

1. **Customer Intelligence**
   - See all QB customers in portal
   - Match with shipment data
   - Track payment history
   - Identify at-risk accounts

2. **Invoice Reconciliation**
   - Match QB invoices with shipments
   - Auto-detect discrepancies
   - Track payment status
   - Generate AR aging reports

3. **Expense Tracking**
   - Match QB expenses with NRE budgets
   - Track vendor spending
   - Category-wise expense breakdown
   - Budget vs. Actual analysis

4. **Financial Reporting**
   - Combined P&L (QB + Portal data)
   - Cash flow forecasting
   - Vendor payment schedules
   - Project profitability analysis

---

## 🐛 Troubleshooting

### "QuickBooks menu doesn't appear"
- Check your email is in `QUICKBOOKS_WHITELIST`
- Verify you're logged in as super admin
- Clear browser cache and reload

### "Setup Required" page appears
- Add QB credentials to `.env.local`
- Restart dev server after adding env vars
- Verify credentials are correct

### "No active connection" error
- Run database migration first
- Check Supabase connection
- Verify RLS policies are set up

### "Sync fails" error
- Check OAuth token hasn't expired
- Verify QB API credentials
- Check network connectivity to QB API
- Review sync log table for details

---

## 📚 Next Steps

1. ✅ **YOU ARE HERE**: Infrastructure ready, feature flag working
2. ⏭️ **Next**: Create QB sandbox account and test OAuth
3. ⏭️ **Then**: Implement customer sync locally
4. ⏭️ **Then**: Test invoice sync locally
5. ⏭️ **Finally**: Deploy to production (Steve only)

---

## 🎯 Key Benefits of This Approach

- ✅ **Non-Disruptive**: Only you can see it initially
- ✅ **Testable**: Full local development environment
- ✅ **Incremental**: Each phase is a small, testable step
- ✅ **Safe**: Feature flag prevents accidental exposure
- ✅ **Reversible**: Can disconnect/disable at any time
- ✅ **Auditable**: Full sync log of all operations
- ✅ **Scalable**: Easy to add more users gradually

---

## 💡 Pro Tips

1. **Test in Sandbox First**: Always test new features in QB sandbox before production
2. **Monitor Sync Logs**: Check `quickbooks_sync_log` table regularly
3. **Token Expiry**: Implement auto-refresh before 60-minute expiration
4. **Rate Limits**: QB API has rate limits, implement backoff strategy
5. **Webhooks**: Consider QB webhooks for real-time updates (Phase 3)
6. **Data Privacy**: Never log sensitive financial data in plain text
7. **Backup**: Always backup database before major changes

---

## 📞 Support

- **QuickBooks API Docs**: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account
- **OAuth 2.0 Guide**: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0
- **SDK Documentation**: https://www.npmjs.com/package/node-quickbooks
- **Intuit Developer Forums**: https://help.developer.intuit.com/s/

---

**Ready to start? Begin with Phase 1, Step 1.1! 🚀**

