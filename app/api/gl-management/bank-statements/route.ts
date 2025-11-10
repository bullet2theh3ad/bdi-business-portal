import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';

/**
 * GET /api/gl-management/bank-statements
 * Fetch bank statements with pagination and filters
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
    const batchId = searchParams.get('batchId');
    const isMatched = searchParams.get('isMatched');

    // Build query
    let query = supabaseService
      .from('bank_statements')
      .select('*', { count: 'exact' })
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
    if (batchId) {
      query = query.eq('upload_batch_id', batchId);
    }
    if (isMatched !== null && isMatched !== undefined) {
      query = query.eq('is_matched', isMatched === 'true');
    }

    const { data: statements, error, count } = await query;

    if (error) {
      console.error('Error fetching bank statements:', error);
      throw error;
    }

    return NextResponse.json({
      statements: statements || [],
      count: count || 0,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Error in GET /api/gl-management/bank-statements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bank statements', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/gl-management/bank-statements
 * Update individual bank statement (simplified interface)
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
    const { id, account_type, category, notes, balance, is_matched } = body;

    // Debug: Log incoming update request
    console.log(`💾 [Bank Statement PUT] ID: ${id}`);
    console.log(`  - account_type: ${account_type}`);
    console.log(`  - category: ${category}`);
    console.log(`  - is_matched: ${is_matched}`);
    console.log(`  - balance: ${balance}`);

    if (!id) {
      return NextResponse.json({ error: 'Statement ID required' }, { status: 400 });
    }

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (account_type !== undefined) updates.account_type = account_type;
    if (category !== undefined) updates.category = category;
    if (notes !== undefined) updates.notes = notes;
    if (balance !== undefined) updates.balance = balance;
    if (is_matched !== undefined) updates.is_matched = is_matched;

    // If marking as matched, set matched_at and matched_by
    if (is_matched === true) {
      updates.matched_at = new Date().toISOString();
      updates.matched_by = user.id;
    } else if (is_matched === false) {
      updates.matched_at = null;
      updates.matched_by = null;
      updates.matched_qb_transaction_type = null;
      updates.matched_qb_transaction_id = null;
    }

    const { data: updated, error } = await supabaseService
      .from('bank_statements')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ [Bank Statement PUT] Error updating:', error);
      throw error;
    }

    // Debug: Confirm save
    console.log(`✅ [Bank Statement PUT] Successfully saved ID: ${id}`);
    console.log(`  - Saved category: ${updated.category}`);
    console.log(`  - Saved account_type: ${updated.account_type}`);
    console.log(`  - Saved is_matched: ${updated.is_matched}`);

    return NextResponse.json({
      statement: updated,
      message: 'Bank statement updated successfully',
    });

  } catch (error) {
    console.error('Error in PUT /api/gl-management/bank-statements:', error);
    return NextResponse.json(
      { error: 'Failed to update bank statement', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/gl-management/bank-statements
 * Update individual bank statement
 */
export async function PATCH(request: NextRequest) {
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
    const { id, updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Statement ID required' }, { status: 400 });
    }

    // Validate updates object
    const allowedFields = [
      'description',
      'category',
      'gl_code_assignment',
      'high_level_category',
      'notes',
      'bank_transaction_number',
      'matched_qb_transaction_type',
      'matched_qb_transaction_id',
      'is_matched',
    ];

    const filteredUpdates: any = {};
    for (const key of allowedFields) {
      if (key in updates) {
        filteredUpdates[key] = updates[key];
      }
    }

    // If marking as matched, set matched_at and matched_by
    if (updates.is_matched === true) {
      filteredUpdates.matched_at = new Date().toISOString();
      filteredUpdates.matched_by = user.id;
    } else if (updates.is_matched === false) {
      filteredUpdates.matched_at = null;
      filteredUpdates.matched_by = null;
      filteredUpdates.matched_qb_transaction_type = null;
      filteredUpdates.matched_qb_transaction_id = null;
    }

    const { data: updated, error } = await supabaseService
      .from('bank_statements')
      .update(filteredUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating bank statement:', error);
      throw error;
    }

    return NextResponse.json({
      statement: updated,
      message: 'Bank statement updated successfully',
    });

  } catch (error) {
    console.error('Error in PATCH /api/gl-management/bank-statements:', error);
    return NextResponse.json(
      { error: 'Failed to update bank statement', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/gl-management/bank-statements
 * Delete bank statement(s)
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
    const batchId = searchParams.get('batchId');

    if (!id && !batchId) {
      return NextResponse.json({ error: 'Statement ID or Batch ID required' }, { status: 400 });
    }

    let query = supabaseService.from('bank_statements').delete();

    if (id) {
      query = query.eq('id', id);
    } else if (batchId) {
      query = query.eq('upload_batch_id', batchId);
    }

    const { error } = await query;

    if (error) {
      console.error('Error deleting bank statement(s):', error);
      throw error;
    }

    return NextResponse.json({
      message: id ? 'Bank statement deleted successfully' : 'Bank statements batch deleted successfully',
    });

  } catch (error) {
    console.error('Error in DELETE /api/gl-management/bank-statements:', error);
    return NextResponse.json(
      { error: 'Failed to delete bank statement(s)', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

