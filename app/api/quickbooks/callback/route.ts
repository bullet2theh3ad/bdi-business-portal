import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const realmId = searchParams.get('realmId');
    const error = searchParams.get('error');

    // Handle errors from QuickBooks
    if (error) {
      console.error('QuickBooks OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/admin/quickbooks?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Validate required parameters
    if (!code || !realmId) {
      return NextResponse.redirect(
        new URL('/admin/quickbooks?error=missing_parameters', request.url)
      );
    }

    console.log('📥 OAuth callback received:', { code: code.substring(0, 20) + '...', realmId });

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI!,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/admin/quickbooks?error=token_exchange_failed', request.url)
      );
    }

    const tokens = await tokenResponse.json();
    console.log('✅ Access token obtained');

    // Get company info from QuickBooks
    let companyInfo = null;
    try {
      const companyResponse = await fetch(
        `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${tokens.access_token}`,
          },
        }
      );

      if (companyResponse.ok) {
        const companyData = await companyResponse.json();
        companyInfo = companyData.CompanyInfo;
        console.log('✅ Company info retrieved:', companyInfo?.CompanyName);
      }
    } catch (err) {
      console.warn('Could not fetch company info:', err);
    }

    // Save to database
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(
        new URL('/admin/quickbooks?error=unauthorized', request.url)
      );
    }

    // Calculate token expiry (typically 60 minutes)
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expires_in || 3600));

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('quickbooks_connections')
      .select('id')
      .eq('realm_id', realmId)
      .single();

    if (existingConnection) {
      // Update existing connection
      const { error: updateError } = await supabase
        .from('quickbooks_connections')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          company_name: companyInfo?.CompanyName || null,
          company_email: companyInfo?.Email?.Address || null,
          company_country: companyInfo?.Country || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConnection.id);

      if (updateError) {
        console.error('Failed to update connection:', updateError);
        throw updateError;
      }

      console.log('✅ Updated existing QuickBooks connection');
    } else {
      // Create new connection
      const { error: insertError } = await supabase
        .from('quickbooks_connections')
        .insert({
          realm_id: realmId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          company_name: companyInfo?.CompanyName || null,
          company_email: companyInfo?.Email?.Address || null,
          company_country: companyInfo?.Country || null,
          connected_by: user.id,
          is_active: true,
        });

      if (insertError) {
        console.error('Failed to save connection:', insertError);
        throw insertError;
      }

      console.log('✅ Saved new QuickBooks connection to database');
    }

    // Redirect to success page
    return NextResponse.redirect(
      new URL('/admin/quickbooks?success=true', request.url)
    );

  } catch (error: any) {
    console.error('Error in QuickBooks OAuth callback:', error);
    return NextResponse.redirect(
      new URL(`/admin/quickbooks?error=${encodeURIComponent(error.message || 'unknown_error')}`, request.url)
    );
  }
}

