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
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';
    const activeOnly = searchParams.get('activeOnly') === 'true';

    // Build query
    let query = supabaseService
      .from('quickbooks_items')
      .select('*')
      .order('name');

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: items, error: itemsError } = await query;

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      throw itemsError;
    }

    // Get item stats
    const { data: stats } = await supabaseService
      .from('quickbooks_items')
      .select('type, is_active', { count: 'exact', head: false });

    const itemStats = {
      total: items?.length || 0,
      active: stats?.filter(s => s.is_active).length || 0,
      inactive: stats?.filter(s => !s.is_active).length || 0,
      byType: stats?.reduce((acc: any, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {}) || {},
    };

    return NextResponse.json({
      items: items || [],
      stats: itemStats,
      message: 'Items retrieved successfully'
    });

  } catch (error) {
    console.error('Error in GET /api/quickbooks/items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

