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
    if (!process.env.QUICKBOOKS_CLIENT_ID || !process.env.QUICKBOOKS_CLIENT_SECRET || !process.env.QUICKBOOKS_REDIRECT_URI) {
      return NextResponse.redirect(
        new URL('/admin/quickbooks?error=missing_credentials', request.url)
      );
    }

    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(7);

    // Build QuickBooks OAuth URL
    const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2');
    authUrl.searchParams.append('client_id', process.env.QUICKBOOKS_CLIENT_ID);
    authUrl.searchParams.append('scope', 'com.intuit.quickbooks.accounting');
    authUrl.searchParams.append('redirect_uri', process.env.QUICKBOOKS_REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', state);

    console.log('🔐 Redirecting to QuickBooks OAuth:', authUrl.toString());

    // Redirect to QuickBooks for authorization
    return NextResponse.redirect(authUrl.toString());

  } catch (error) {
    console.error('Error in GET /api/quickbooks/auth:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

