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

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const importBatchId = searchParams.get('importBatchId');
    const sku = searchParams.get('sku');
    const source = searchParams.get('source');

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

    // Build base query for active WIP units (not outflow)
    let baseQuery = supabaseService
      .from('warehouse_wip_units')
      .select('aging_bucket')
      .neq('stage', 'Outflow')
      .not('aging_bucket', 'is', null);

    // Apply filters
    if (importBatchId) {
      baseQuery = baseQuery.eq('import_batch_id', importBatchId);
    }
    if (sku) {
      baseQuery = baseQuery.eq('model_number', sku);
    }
    if (source) {
      baseQuery = baseQuery.ilike('source', `%${source}%`);
    }

    const { data: agingData, error } = await baseQuery;

    if (error) {
      throw error;
    }

    // Count by bucket
    const bucketCounts: Record<string, number> = {
      '0-7': 0,
      '8-14': 0,
      '15-30': 0,
      '>30': 0,
    };

    agingData?.forEach((unit: any) => {
      if (unit.aging_bucket && bucketCounts.hasOwnProperty(unit.aging_bucket)) {
        bucketCounts[unit.aging_bucket]++;
      }
    });

    // Format for chart
    const result = Object.entries(bucketCounts).map(([bucket, count]) => ({
      bucket,
      count,
    }));

    return NextResponse.json({ aging: result });

  } catch (error: any) {
    console.error('❌ Aging API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

