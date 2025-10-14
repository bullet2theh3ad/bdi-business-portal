# Vercel Environment Variables for QuickBooks

## Add these to Vercel Dashboard → Settings → Environment Variables

```bash
# QuickBooks Production Keys
QUICKBOOKS_CLIENT_ID=AB6Yzp5JjgtnFkYOk7Y6CDYG45nd9BRAbyr12cTiI6URiH2Qyt
QUICKBOOKS_CLIENT_SECRET=CKXnWp3LzIExXC0Y8RXAitkJkspv1juUO9gFlOOh

# Production environment (real data)
QUICKBOOKS_ENVIRONMENT=production
QUICKBOOKS_API_BASE_URL=https://quickbooks.api.intuit.com

# Redirect URI (production domain)
QUICKBOOKS_REDIRECT_URI=https://bdibusinessportal.com/api/quickbooks/callback
```

## Update QuickBooks Developer Portal

Go to: https://developer.intuit.com/app/developer/dashboard

1. Click your app
2. Go to **"Keys & credentials"** tab
3. Select **"Production Keys"** section
4. Under **"Redirect URIs"**, ensure this is listed:
   ```
   https://bdibusinessportal.com/api/quickbooks/callback
   ```
5. Click **Save**

## Important Notes

- **Production Keys** can ONLY connect to **Real QuickBooks companies**
- **Development Keys** can ONLY connect to **Sandbox companies**
- Since you deleted your sandbox company, you MUST use Production Keys on a live domain
- `localhost` is NOT allowed with Production Keys (that's why we need Vercel)

## Testing After Deployment

1. Go to: https://bdibusinessportal.com/admin/quickbooks
2. Click "Connect to QuickBooks"
3. You should see **"Boundless Devices Inc"** (your real company)
4. Authorize the connection
5. Run "Full Sync" to pull all your real data

## Local Development Note

For local development with real data, you would need to:
1. Create a new Sandbox company in QuickBooks
2. Use Development Keys
3. Connect to the sandbox company
4. Work with test data locally

However, since you want to work with real data, you'll need to test on the production deployment.

