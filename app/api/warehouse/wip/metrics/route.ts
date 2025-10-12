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

    // Build base query for total intake
    let query = supabaseService.from('warehouse_wip_units').select('*', { count: 'exact', head: true });

    // Apply filters
    if (importBatchId) {
      query = query.eq('import_batch_id', importBatchId);
    }
    if (sku) {
      query = query.eq('model_number', sku);
    }
    if (source) {
      query = query.eq('source', source); // Changed from ilike to eq for exact match
    }
    if (fromDate) {
      query = query.gte('received_date', fromDate);
    }
    if (toDate) {
      query = query.lte('received_date', toDate);
    }

    // Get total count
    const { count: totalIntake } = await query;

    // Get counts by stage (with proper source filtering)
    let wipQuery = supabaseService
      .from('warehouse_wip_units')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'WIP');
    if (importBatchId) wipQuery = wipQuery.eq('import_batch_id', importBatchId);
    if (sku) wipQuery = wipQuery.eq('model_number', sku);
    if (source) wipQuery = wipQuery.eq('source', source);
    if (fromDate) wipQuery = wipQuery.gte('received_date', fromDate);
    if (toDate) wipQuery = wipQuery.lte('received_date', toDate);
    const { count: wipCount } = await wipQuery;

    let rmaQuery = supabaseService
      .from('warehouse_wip_units')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'RMA');
    if (importBatchId) rmaQuery = rmaQuery.eq('import_batch_id', importBatchId);
    if (sku) rmaQuery = rmaQuery.eq('model_number', sku);
    if (source) rmaQuery = rmaQuery.eq('source', source);
    if (fromDate) rmaQuery = rmaQuery.gte('received_date', fromDate);
    if (toDate) rmaQuery = rmaQuery.lte('received_date', toDate);
    const { count: rmaCount } = await rmaQuery;

    let outflowQuery = supabaseService
      .from('warehouse_wip_units')
      .select('*', { count: 'exact', head: true })
      .eq('stage', 'Outflow');
    if (importBatchId) outflowQuery = outflowQuery.eq('import_batch_id', importBatchId);
    if (sku) outflowQuery = outflowQuery.eq('model_number', sku);
    if (source) outflowQuery = outflowQuery.eq('source', source);
    if (fromDate) outflowQuery = outflowQuery.gte('received_date', fromDate);
    if (toDate) outflowQuery = outflowQuery.lte('received_date', toDate);
    const { count: outflowCount } = await outflowQuery;

    let intakeQuery = supabaseService
      .from('warehouse_wip_units')
      .select('*', { count: 'exact', head: true })
      .in('stage', ['Intake', 'Other Intake']);
    if (importBatchId) intakeQuery = intakeQuery.eq('import_batch_id', importBatchId);
    if (sku) intakeQuery = intakeQuery.eq('model_number', sku);
    if (source) intakeQuery = intakeQuery.eq('source', source);
    if (fromDate) intakeQuery = intakeQuery.gte('received_date', fromDate);
    if (toDate) intakeQuery = intakeQuery.lte('received_date', toDate);
    const { count: intakeCount } = await intakeQuery;

    // Calculate average aging for active WIP (with proper source filtering)
    let agingQuery = supabaseService
      .from('warehouse_wip_units')
      .select('aging_days')
      .eq('stage', 'WIP')
      .not('aging_days', 'is', null);
    if (importBatchId) agingQuery = agingQuery.eq('import_batch_id', importBatchId);
    if (sku) agingQuery = agingQuery.eq('model_number', sku);
    if (source) agingQuery = agingQuery.eq('source', source);
    if (fromDate) agingQuery = agingQuery.gte('received_date', fromDate);
    if (toDate) agingQuery = agingQuery.lte('received_date', toDate);
    const { data: agingData } = await agingQuery;

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

