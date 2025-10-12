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
      .select('iso_year_week_received, stage')
      .not('iso_year_week_received', 'is', null)
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

    // Group by week
    // For Intake: count units received in that week (regardless of current stage)
    // For other stages: count units in that stage received in/before that week
    const weeklyData: Record<string, Record<string, number>> = {};

    units?.forEach((unit: any) => {
      const week = unit.iso_year_week_received;

      if (!weeklyData[week]) {
        weeklyData[week] = {
          Intake: 0,
          WIP: 0,
          RMA: 0,
          Outflow: 0,
        };
      }

      // Count all units received this week as Intake
      weeklyData[week].Intake++;

      // Also count by current stage for the other metrics
      const stage = unit.stage;
      if (stage === 'WIP') {
        weeklyData[week].WIP++;
      } else if (stage === 'RMA') {
        weeklyData[week].RMA++;
      } else if (stage === 'Outflow') {
        weeklyData[week].Outflow++;
      }
    });

    // Sort weeks and format for chart
    const sortedWeeks = Object.keys(weeklyData).sort();
    
    const result = sortedWeeks.map((week) => ({
      week,
      ...weeklyData[week],
    }));

    return NextResponse.json({ cfd: result });

  } catch (error: any) {
    console.error('❌ CFD API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

