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
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    // Use direct Supabase client for queries
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

    // Build base query
    let query = supabaseService.from('warehouse_wip_units').select('*', { count: 'exact', head: true });

    // Apply filters
    if (importBatchId) {
      query = query.eq('import_batch_id', importBatchId);
    }
    if (sku) {
      query = query.eq('model_number', sku);
    }
    if (source) {
      query = query.ilike('source', `%${source}%`);
    }
    if (fromDate) {
      query = query.gte('received_date', fromDate);
    }
    if (toDate) {
      query = query.lte('received_date', toDate);
    }

    // Get total count
    const { count: totalIntake } = await query;

    // Get counts by stage
    const { count: wipCount } = await supabaseService
      .from('warehouse_wip_units')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'WIP')
      .match(buildFilters(importBatchId, sku, source, fromDate, toDate));

    const { count: rmaCount } = await supabaseService
      .from('warehouse_wip_units')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'RMA')
      .match(buildFilters(importBatchId, sku, source, fromDate, toDate));

    const { count: outflowCount } = await supabaseService
      .from('warehouse_wip_units')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'Outflow')
      .match(buildFilters(importBatchId, sku, source, fromDate, toDate));

    const { count: intakeCount } = await supabaseService
      .from('warehouse_wip_units')
      .select('*', { count: 'exact', head: true })
      .in('stage', ['Intake', 'Other Intake'])
      .match(buildFilters(importBatchId, sku, source, fromDate, toDate));

    // Calculate average aging for active WIP
    const { data: agingData } = await supabaseService
      .from('warehouse_wip_units')
      .select('aging_days')
      .eq('stage', 'WIP')
      .match(buildFilters(importBatchId, sku, source, fromDate, toDate))
      .not('aging_days', 'is', null);

    const avgAgingDays = agingData && agingData.length > 0
      ? Math.round(agingData.reduce((sum: number, u: any) => sum + (u.aging_days || 0), 0) / agingData.length)
      : 0;

    return NextResponse.json({
      totalIntake: totalIntake || 0,
      intake: intakeCount || 0,
      wip: wipCount || 0,
      rma: rmaCount || 0,
      outflow: outflowCount || 0,
      avgAgingDays,
    });

  } catch (error: any) {
    console.error('❌ Metrics API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper to build filter object
function buildFilters(
  importBatchId?: string | null,
  sku?: string | null,
  source?: string | null,
  fromDate?: string | null,
  toDate?: string | null
) {
  const filters: any = {};
  
  if (importBatchId) filters.import_batch_id = importBatchId;
  if (sku) filters.model_number = sku;
  // Note: source uses ilike, handle separately in queries
  
  return filters;
}

