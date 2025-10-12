import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user role
    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (!dbUser || !['super_admin', 'admin', 'operations'].includes(dbUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const importBatchId = searchParams.get('importBatchId');
    const sku = searchParams.get('sku');
    const source = searchParams.get('source');
    const stage = searchParams.get('stage');
    const search = searchParams.get('search'); // For serial number search
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Use direct Supabase client
    const { createClient } = require('@supabase/supabase-js');
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Build query
    let query = supabaseService
      .from('warehouse_wip_units')
      .select('*', { count: 'exact' });

    // Apply filters
    if (importBatchId) {
      query = query.eq('import_batch_id', importBatchId);
    }
    if (sku) {
      query = query.eq('model_number', sku);
    }
    if (source) {
      query = query.eq('source', source);
    }
    if (stage) {
      query = query.eq('stage', stage);
    }
    if (search) {
      query = query.ilike('serial_number', `%${search}%`);
    }
    if (dateFrom) {
      query = query.gte('received_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('received_date', dateTo);
    }

    // Apply pagination and sorting
    query = query
      .order('received_date', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: units, count, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      units: units || [],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    });

  } catch (error: any) {
    console.error('❌ Units API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

