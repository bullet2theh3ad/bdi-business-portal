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
      .select('stage')
      .not('stage', 'is', null);

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

    const { data: units, error } = await query;

    if (error) {
      throw error;
    }

    // Count by stage
    const stageCounts: Record<string, number> = {
      Intake: 0,
      'Other Intake': 0,
      WIP: 0,
      RMA: 0,
      Outflow: 0,
    };

    units?.forEach((unit: any) => {
      if (stageCounts.hasOwnProperty(unit.stage)) {
        stageCounts[unit.stage]++;
      }
    });

    // Build Sankey nodes and links
    // Simplified flow: Intake -> WIP -> Outflow
    //                  Intake -> RMA -> Outflow
    const nodes = [
      { id: 0, name: 'Intake' },
      { id: 1, name: 'WIP' },
      { id: 2, name: 'RMA' },
      { id: 3, name: 'Outflow' },
    ];

    const totalIntake = stageCounts['Intake'] + stageCounts['Other Intake'];

    const links = [
      {
        source: 0, // Intake
        target: 1, // WIP
        value: stageCounts['WIP'] || 0,
      },
      {
        source: 0, // Intake
        target: 2, // RMA
        value: stageCounts['RMA'] || 0,
      },
      {
        source: 1, // WIP
        target: 3, // Outflow
        value: Math.floor(stageCounts['Outflow'] * 0.7) || 0, // Approximate 70% from WIP
      },
      {
        source: 2, // RMA
        target: 3, // Outflow
        value: Math.floor(stageCounts['Outflow'] * 0.3) || 0, // Approximate 30% from RMA
      },
    ];

    return NextResponse.json({
      nodes,
      links: links.filter(l => l.value > 0), // Only include non-zero links
      stageCounts,
    });

  } catch (error: any) {
    console.error('❌ Flow API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

