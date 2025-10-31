import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';

/**
 * GET /api/gl-code-assignments
 * Fetches all GL code category assignments
 */
export async function GET() {
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

    // Fetch all GL code assignments
    const { data: assignments, error } = await supabase
      .from('gl_code_assignments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching GL code assignments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch GL code assignments' },
        { status: 500 }
      );
    }

    return NextResponse.json(assignments || []);
  } catch (error) {
    console.error('Error in GET /api/gl-code-assignments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gl-code-assignments
 * Saves GL code category assignments (bulk upsert)
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

    // Parse request body
    const body = await request.json();
    const { assignments } = body;

    if (!Array.isArray(assignments)) {
      return NextResponse.json(
        { error: 'Invalid request: assignments must be an array' },
        { status: 400 }
      );
    }

    // Validate assignments
    const validCategories = ['opex', 'cogs', 'inventory', 'nre', 'ignore', 'unassigned'];
    for (const assignment of assignments) {
      if (!assignment.qbAccountId) {
        return NextResponse.json(
          { error: 'Invalid assignment: missing qbAccountId' },
          { status: 400 }
        );
      }
      if (!validCategories.includes(assignment.category)) {
        return NextResponse.json(
          { error: `Invalid assignment: category must be one of ${validCategories.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Convert to database format
    const assignmentsToSave = assignments.map(a => ({
      qb_account_id: a.qbAccountId,
      category: a.category,
      include_in_cash_flow: a.includeInCashFlow,
    }));

    // Bulk upsert using Supabase
    const { data, error } = await supabase
      .from('gl_code_assignments')
      .upsert(assignmentsToSave, {
        onConflict: 'qb_account_id',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error('Error saving GL code assignments:', error);
      return NextResponse.json(
        { error: 'Failed to save GL code assignments', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      saved: data?.length || 0,
      message: 'GL code assignments saved successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/gl-code-assignments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

