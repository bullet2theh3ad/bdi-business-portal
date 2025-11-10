import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';

/**
 * GET /api/gl-management/ramp-transactions
 * Fetch Ramp transactions with pagination and filters
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check feature flag access
    if (!canAccessQuickBooks(user.email)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Use service role for data access
    const supabaseService = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '1000');
    const offset = parseInt(searchParams.get('offset') || '0');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');

    // Build query
    let query = supabaseService
      .from('ramp_transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }
    if (endDate) {
      query = query.lte('transaction_date', endDate);
    }
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching Ramp transactions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);

  } catch (error: any) {
    console.error('Error in Ramp transactions GET:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/gl-management/ramp-transactions
 * Update a Ramp transaction (for inline editing)
 */
export async function PUT(request: NextRequest) {
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
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Use service role for data access
    const supabaseService = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

    const body = await request.json();
    const { id, account_type, category, notes, balance_usd, is_matched } = body;

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
    }

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    // Update fields if provided
    if (account_type !== undefined) updates.account_type = account_type;
    if (category !== undefined) updates.category = category;
    if (notes !== undefined) updates.notes = notes;
    if (balance_usd !== undefined) updates.balance_usd = balance_usd;
    if (is_matched !== undefined) {
      updates.is_matched = is_matched;
      if (is_matched) {
        updates.matched_at = new Date().toISOString();
        updates.matched_by = user.id;
      }
    }

    console.log(`📝 [Ramp PUT] Updating transaction ${id}:`, {
      account_type: updates.account_type,
      category: updates.category,
      is_matched: updates.is_matched
    });

    const { data, error } = await supabaseService
      .from('ramp_transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating Ramp transaction:', error);
      return NextResponse.json(
        { error: 'Failed to update transaction' },
        { status: 500 }
      );
    }

    console.log(`✅ [Ramp PUT] Successfully updated transaction ${id}`);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Error in Ramp transactions PUT:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/gl-management/ramp-transactions
 * Delete a Ramp transaction
 */
export async function DELETE(request: NextRequest) {
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
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Use service role for data access
    const supabaseService = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
    }

    const { error } = await supabaseService
      .from('ramp_transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting Ramp transaction:', error);
      return NextResponse.json(
        { error: 'Failed to delete transaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error in Ramp transactions DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

