import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

/**
 * GET /api/warehouse/wip/status
 * Fetches WIP Status data for visualization
 * 
 * Query params:
 * - sku: Filter by specific SKU/model (optional)
 * - status: Filter by specific status (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const skuFilter = searchParams.get('sku');
    const statusFilter = searchParams.get('status');

    console.log('[WIP Status API] Fetching status data...', { skuFilter, statusFilter });

    // Fetch ALL records with pagination (Supabase limit is 1000 per request)
    let units: any[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      console.log(`[WIP Status API] Fetching page ${page + 1} (rows ${from}-${to})...`);

      let query = supabaseService
        .from('warehouse_wip_units')
        .select('*')
        .order('received_date', { ascending: false })
        .range(from, to);

      // Apply filters if provided
      if (skuFilter) {
        query = query.eq('model_number', skuFilter);
      }
      if (statusFilter) {
        query = query.eq('wip_status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[WIP Status API] Error fetching units:', error);
        return NextResponse.json(
          { error: 'Failed to fetch WIP status data' },
          { status: 500 }
        );
      }

      if (data && data.length > 0) {
        units = units.concat(data);
        console.log(`[WIP Status API] Page ${page + 1}: Fetched ${data.length} records (Total: ${units.length})`);
        
        // Check if we got less than pageSize (means we're done)
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`[WIP Status API] ✅ Fetched total of ${units.length} records`);

    // Group by WIP Status
    const statusGroups: Record<string, any[]> = {};
    const skuBreakdown: Record<string, Record<string, number>> = {};
    const statusTotals: Record<string, number> = {};

    // Valid status values (for ordering)
    const statusOrder = [
      'RECEIVED',
      'PASSED',
      'FAILED',
      'RTS-NEW',
      'RTS-KITTED',
      'RECYCLED',
      'SHIPPED',
      'RMA_SHIPPED',
      'MISSING',
    ];

    // Initialize counts
    statusOrder.forEach(status => {
      statusGroups[status] = [];
      statusTotals[status] = 0;
      skuBreakdown[status] = {};
    });

    // Handle null/blank status as "RECEIVED" (default)
    statusGroups['UNASSIGNED'] = [];
    statusTotals['UNASSIGNED'] = 0;
    skuBreakdown['UNASSIGNED'] = {};

    // Process units
    units?.forEach(unit => {
      const status = unit.wip_status || 'UNASSIGNED';
      const sku = unit.model_number;

      // Add to status group
      if (!statusGroups[status]) {
        statusGroups[status] = [];
        statusTotals[status] = 0;
        skuBreakdown[status] = {};
      }

      statusGroups[status].push(unit);
      statusTotals[status]++;

      // Add to SKU breakdown
      if (!skuBreakdown[status][sku]) {
        skuBreakdown[status][sku] = 0;
      }
      skuBreakdown[status][sku]++;
    });

    // Calculate total units
    const totalUnits = units?.length || 0;

    // Calculate percentages
    const statusPercentages: Record<string, number> = {};
    Object.keys(statusTotals).forEach(status => {
      statusPercentages[status] = totalUnits > 0 
        ? Math.round((statusTotals[status] / totalUnits) * 1000) / 10 
        : 0;
    });

    // Get top SKUs overall
    const skuCounts: Record<string, number> = {};
    units?.forEach(unit => {
      const sku = unit.model_number;
      skuCounts[sku] = (skuCounts[sku] || 0) + 1;
    });

    const topSkus = Object.entries(skuCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([sku, count]) => ({ sku, count }));

    // Get list of unique SKUs for filtering
    const allSkus = Array.from(new Set(units?.map(u => u.model_number) || []))
      .sort();

    // Summary metrics
    const avgDaysInWip = units && units.length > 0
      ? Math.round(
          units
            .filter(u => u.received_date)
            .map(u => {
              const received = new Date(u.received_date!);
              const now = new Date();
              return Math.floor((now.getTime() - received.getTime()) / (1000 * 60 * 60 * 24));
            })
            .reduce((sum, days) => sum + days, 0) / units.filter(u => u.received_date).length
        )
      : 0;

    // Units stuck in FAILED or MISSING status for > 30 days
    const stuckUnits = units?.filter(u => {
      if (!u.received_date) return false;
      if (u.wip_status !== 'FAILED' && u.wip_status !== 'MISSING') return false;
      const received = new Date(u.received_date);
      const now = new Date();
      const days = Math.floor((now.getTime() - received.getTime()) / (1000 * 60 * 60 * 24));
      return days > 30;
    }).length || 0;

    // This week's receipts (RECEIVED status added in last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeekReceipts = units?.filter(u => 
      u.received_date && new Date(u.received_date) >= oneWeekAgo
    ).length || 0;

    const response = {
      summary: {
        totalUnits,
        avgDaysInWip,
        thisWeekReceipts,
        stuckUnits,
      },
      statusTotals,
      statusPercentages,
      statusGroups,
      skuBreakdown,
      topSkus,
      allSkus,
      statusOrder: [...statusOrder, 'UNASSIGNED'],
    };

    console.log('[WIP Status API] Success:', {
      totalUnits,
      statusCount: Object.keys(statusTotals).length,
      skuCount: allSkus.length,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[WIP Status API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

