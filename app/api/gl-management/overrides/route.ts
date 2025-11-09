import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';

/**
 * GET /api/gl-management/overrides
 * Fetch transaction overrides
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
    const transactionSource = searchParams.get('transactionSource');
    const transactionId = searchParams.get('transactionId');

    // Build query
    let query = supabaseService
      .from('gl_transaction_overrides')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (transactionSource) {
      query = query.eq('transaction_source', transactionSource);
    }
    if (transactionId) {
      query = query.eq('transaction_id', transactionId);
    }

    const { data: overrides, error } = await query;

    if (error) {
      console.error('Error fetching overrides:', error);
      throw error;
    }

    return NextResponse.json({
      overrides: overrides || [],
      count: overrides?.length || 0,
    });

  } catch (error) {
    console.error('Error in GET /api/gl-management/overrides:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overrides', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gl-management/overrides
 * Create or update transaction override(s)
 * Supports both single override and bulk operations
 */
export async function POST(request: NextRequest) {
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
    const { overrides } = body;

    // Support both single override and bulk array
    const overrideArray = Array.isArray(overrides) ? overrides : [overrides];

    if (overrideArray.length === 0) {
      return NextResponse.json({ error: 'No overrides provided' }, { status: 400 });
    }

    // Validate and prepare overrides
    const preparedOverrides = overrideArray.map((override: any) => {
      if (!override.transaction_source || !override.transaction_id) {
        throw new Error('transaction_source and transaction_id are required');
      }

      return {
        transaction_source: override.transaction_source,
        transaction_id: override.transaction_id,
        line_item_index: override.line_item_index || null,
        original_category: override.original_category || null,
        override_category: override.override_category || null,
        original_gl_code: override.original_gl_code || null,
        assigned_gl_code: override.assigned_gl_code || null,
        notes: override.notes || null,
        bank_transaction_number: override.bank_transaction_number || null,
        original_description: override.original_description || null,
        override_description: override.override_description || null,
        original_amount: override.original_amount || null,
        adjusted_amount: override.adjusted_amount || null,
        created_by: user.id,
      };
    });

    // Upsert overrides (insert or update if exists)
    const { data: saved, error } = await supabaseService
      .from('gl_transaction_overrides')
      .upsert(preparedOverrides, {
        onConflict: 'transaction_source,transaction_id,line_item_index',
      })
      .select();

    if (error) {
      console.error('Error saving overrides:', error);
      throw error;
    }

    return NextResponse.json({
      overrides: saved,
      count: saved?.length || 0,
      message: `Successfully saved ${saved?.length || 0} override(s)`,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/gl-management/overrides:', error);
    return NextResponse.json(
      { error: 'Failed to save overrides', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/gl-management/overrides
 * Delete transaction override
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
      return NextResponse.json({ error: 'Override ID required' }, { status: 400 });
    }

    const { error } = await supabaseService
      .from('gl_transaction_overrides')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting override:', error);
      throw error;
    }

    return NextResponse.json({
      message: 'Override deleted successfully',
    });

  } catch (error) {
    console.error('Error in DELETE /api/gl-management/overrides:', error);
    return NextResponse.json(
      { error: 'Failed to delete override', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

