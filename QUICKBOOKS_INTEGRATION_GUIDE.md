# QuickBooks Integration Guide

## 🎯 Overview

This integration connects your BDI Portal to QuickBooks Online to:
- Sync customer data for better reporting
- Import invoices and match them with shipments
- Track vendor payments and expenses
- Generate comprehensive financial reports

## 🔐 Access Control

**Who Can See This Feature:**
- Only users in the whitelist (defined in `lib/feature-flags.ts`)
- Currently: `scistulli@boundlessdevices.com`
- To add more users: Edit `QUICKBOOKS_WHITELIST` array

## 📋 QuickBooks Setup (Baby Steps)

### Step 1: Create QuickBooks App

1. Go to [QuickBooks Developer Portal](https://developer.intuit.com/)
2. Sign in with your Intuit account
3. Click **"Create an app"**
4. Choose **"QuickBooks Online API"**
5. Fill in app details:
   - **App Name**: BDI Business Portal
   - **App Description**: Internal business management portal
   - **Category**: Business Management

### Step 2: Configure OAuth Settings

1. In your app dashboard, go to **"Keys & OAuth"**
2. Set **Redirect URI**:
   - **Local Dev**: `http://localhost:3001/api/quickbooks/callback`
   - **Production**: `https://bdibusinessportal.com/api/quickbooks/callback`
3. Copy your credentials:
   - **Client ID**
   - **Client Secret**

### Step 3: Add to Environment Variables

Add these to your `.env.local` file:

```env
# QuickBooks OAuth
QUICKBOOKS_CLIENT_ID=your_client_id_here
QUICKBOOKS_CLIENT_SECRET=your_client_secret_here
QUICKBOOKS_REDIRECT_URI=http://localhost:3001/api/quickbooks/callback

# QuickBooks API (Production uses api.intuit.com)
QUICKBOOKS_ENVIRONMENT=sandbox # or 'production'
QUICKBOOKS_API_BASE_URL=https://sandbox-quickbooks.api.intuit.com
```

### Step 4: Run Database Migration

```bash
# Connect to your Supabase database
psql <your-database-connection-string>

# Run the migration
\i create-quickbooks-integration.sql
```

### Step 5: Install QuickBooks SDK

```bash
pnpm add intuit-oauth node-quickbooks
pnpm add -D @types/node-quickbooks
```

## 🚀 How It Works

### OAuth Flow

1. User clicks **"Connect to QuickBooks"** button
2. User is redirected to QuickBooks login
3. User authorizes BDI Portal
4. QuickBooks redirects back with authorization code
5. We exchange code for access token
6. Token is stored securely in database

### Data Sync

1. **Manual Sync** (Phase 1): Click button to sync data
2. **Scheduled Sync** (Phase 2): Automatic sync every 24 hours
3. **Real-time Webhooks** (Phase 3): QB notifies us of changes

### Data Flow

```
QuickBooks → OAuth → BDI Portal API → Supabase
                ↓
         Store Tokens
                ↓
         Sync Data (Customers, Invoices, Vendors)
                ↓
         Display in Reports
```

## 📊 Integration Phases

### Phase 1: Basic Connection (CURRENT)
- [ ] OAuth setup
- [ ] Connect to QuickBooks button
- [ ] Store connection tokens
- [ ] Display connection status

### Phase 2: Read Customers
- [ ] Fetch customers from QB
- [ ] Display in admin page
- [ ] Sync to database

### Phase 3: Read Invoices
- [ ] Fetch invoices from QB
- [ ] Match with shipments/POs
- [ ] Display in reports

### Phase 4: Read Vendors & Expenses
- [ ] Fetch vendors
- [ ] Fetch expenses/bills
- [ ] Match with NRE budgets

### Phase 5: Financial Reporting
- [ ] Combine QB data with portal data
- [ ] Generate P&L reports
- [ ] Cash flow analysis
- [ ] AR/AP aging reports

## 🔒 Security Considerations

1. **Token Storage**: Tokens are stored encrypted in production
2. **RLS Policies**: Only super admins can access QB data initially
3. **Feature Flags**: Controlled rollout to specific users
4. **OAuth Refresh**: Tokens auto-refresh before expiration
5. **Audit Log**: All sync operations are logged

## 🧪 Testing Locally

1. Use **QuickBooks Sandbox** for development
2. Create test company in sandbox
3. Test OAuth flow at `http://localhost:3001/admin/quickbooks`
4. Verify data sync without affecting production

## 📈 Rollout Plan

1. **Steve only** - Test all features locally
2. **Add internal team** - dzand, finance team
3. **Monitor for 1 week** - Check for errors
4. **Gradual expansion** - Add more users as needed
5. **Full production** - Remove feature flag

## 🐛 Troubleshooting

### "Invalid Redirect URI"
- Make sure redirect URI in QB app matches exactly
- Include `/api/quickbooks/callback` path

### "Token Expired"
- Tokens expire after 60 minutes
- Refresh token is valid for 100 days
- Implement auto-refresh logic

### "Insufficient Permissions"
- Re-authenticate with QB
- Ensure all scopes are requested

## 📚 API Reference

- [QuickBooks API Docs](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account)
- [OAuth 2.0 Guide](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)

## 🎯 Next Steps

1. Run the SQL migration
2. Set up QB app in developer portal
3. Add credentials to `.env.local`
4. Install npm packages
5. Visit `/admin/quickbooks` to test connection

