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
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const vendor = searchParams.get('vendor');

    // Build query
    let query = supabase
      .from('quickbooks_bill_payments')
      .select('*', { count: 'exact' })
      .order('txn_date', { ascending: false })
      .range(offset, offset + limit - 1);

    // Add filters if provided
    if (startDate) {
      query = query.gte('txn_date', startDate);
    }
    if (endDate) {
      query = query.lte('txn_date', endDate);
    }
    if (vendor) {
      query = query.ilike('vendor_name', `%${vendor}%`);
    }

    const { data: billPayments, error, count } = await query;

    if (error) {
      console.error('Error fetching bill payments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bill payments', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      billPayments: billPayments || [],
      count: count || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error('Error in bill payments API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

