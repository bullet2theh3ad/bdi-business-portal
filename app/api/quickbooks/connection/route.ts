import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check feature flag access
    if (!canAccessQuickBooks(user.email)) {
      return NextResponse.json(
        { error: 'Access denied - QuickBooks integration not available for this user' },
        { status: 403 }
      );
    }

    // Get active QuickBooks connection
    const { data: connection, error } = await supabase
      .from('quickbooks_connections')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching QB connection:', error);
      return NextResponse.json(
        { error: 'Failed to fetch connection' },
        { status: 500 }
      );
    }

    if (!connection) {
      return NextResponse.json(
        { connection: null, message: 'No active QuickBooks connection' },
        { status: 404 }
      );
    }

    // Don't send tokens to client
    const { access_token, refresh_token, ...safeConnection } = connection;

    return NextResponse.json({
      connection: safeConnection,
      message: 'Connection retrieved successfully'
    });

  } catch (error) {
    console.error('Error in GET /api/quickbooks/connection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

