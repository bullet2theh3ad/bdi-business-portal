import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';

/**
 * QuickBooks OAuth Authorization Endpoint (Phase 1 - Placeholder)
 * 
 * This endpoint will redirect users to QuickBooks for OAuth authorization.
 * 
 * SETUP REQUIRED:
 * 1. Create app at https://developer.intuit.com/
 * 2. Get Client ID and Secret
 * 3. Add to environment variables:
 *    - QUICKBOOKS_CLIENT_ID
 *    - QUICKBOOKS_CLIENT_SECRET
 *    - QUICKBOOKS_REDIRECT_URI
 * 4. Install package: pnpm add intuit-oauth
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesArray) => {
            cookiesArray.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    // Check feature flag access
    if (!canAccessQuickBooks(user.email)) {
      return new NextResponse('Access denied - QuickBooks integration not available', {
        status: 403,
      });
    }

    // Check if QuickBooks credentials are configured
    if (!process.env.QUICKBOOKS_CLIENT_ID || !process.env.QUICKBOOKS_CLIENT_SECRET) {
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>QuickBooks Setup Required</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                max-width: 800px;
                margin: 50px auto;
                padding: 20px;
                background: #f5f5f5;
              }
              .card {
                background: white;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              h1 { color: #2ca01c; }
              code {
                background: #f0f0f0;
                padding: 2px 6px;
                border-radius: 3px;
                font-family: 'Courier New', monospace;
              }
              .step {
                margin: 20px 0;
                padding: 15px;
                background: #f9f9f9;
                border-left: 4px solid #2ca01c;
              }
              a {
                color: #2ca01c;
                text-decoration: none;
              }
              a:hover {
                text-decoration: underline;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>🔧 QuickBooks Setup Required</h1>
              <p>The QuickBooks integration needs to be configured before you can connect.</p>
              
              <div class="step">
                <h3>Step 1: Create QuickBooks App</h3>
                <p>Go to <a href="https://developer.intuit.com/" target="_blank">QuickBooks Developer Portal</a> and create a new app.</p>
              </div>
              
              <div class="step">
                <h3>Step 2: Get Credentials</h3>
                <p>Copy your <strong>Client ID</strong> and <strong>Client Secret</strong> from the app dashboard.</p>
              </div>
              
              <div class="step">
                <h3>Step 3: Configure Environment</h3>
                <p>Add these to your <code>.env.local</code> file:</p>
                <pre>
QUICKBOOKS_CLIENT_ID=your_client_id_here
QUICKBOOKS_CLIENT_SECRET=your_client_secret_here
QUICKBOOKS_REDIRECT_URI=http://localhost:3001/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox
                </pre>
              </div>
              
              <div class="step">
                <h3>Step 4: Run Database Migration</h3>
                <p>Run the SQL migration: <code>create-quickbooks-integration.sql</code></p>
              </div>
              
              <div class="step">
                <h3>Step 5: Install Dependencies</h3>
                <p>Run: <code>pnpm add intuit-oauth node-quickbooks</code></p>
              </div>
              
              <p style="margin-top: 30px;">
                <a href="/admin/quickbooks">← Back to QuickBooks Dashboard</a>
              </p>
              
              <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
                📚 For detailed instructions, see <code>QUICKBOOKS_INTEGRATION_GUIDE.md</code>
              </p>
            </div>
          </body>
        </html>
        `,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
          },
        }
      );
    }

    // TODO: Implement OAuth flow
    // const OAuthClient = require('intuit-oauth');
    // const oauthClient = new OAuthClient({
    //   clientId: process.env.QUICKBOOKS_CLIENT_ID,
    //   clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
    //   environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
    //   redirectUri: process.env.QUICKBOOKS_REDIRECT_URI,
    // });
    // 
    // const authUri = oauthClient.authorizeUri({
    //   scope: [OAuthClient.scopes.Accounting],
    //   state: 'testState', // TODO: Generate random state and store in session
    // });
    // 
    // return NextResponse.redirect(authUri);

    return new NextResponse(
      'QuickBooks OAuth not yet implemented. Configure credentials first.',
      { status: 501 }
    );

  } catch (error) {
    console.error('Error in GET /api/quickbooks/auth:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

