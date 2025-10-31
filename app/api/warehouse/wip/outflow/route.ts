import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

/**
 * GET /api/warehouse/wip/outflow
 * Fetches Outflow shipped data for visualization
 * 
 * Query params:
 * - destination: Filter by specific destination (optional)
 * - sku: Filter by specific SKU/model (optional)
 * - startDate: Filter by start date (optional)
 * - endDate: Filter by end date (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const destinationFilter = searchParams.get('destination');
    const skuFilter = searchParams.get('sku');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log('[Outflow API] Fetching outflow data...', { 
      destinationFilter, 
      skuFilter,
      startDate,
      endDate 
    });

    // Build query - Only get units with outflow data
    let query = supabaseService
      .from('warehouse_wip_units')
      .select('*')
      .not('outflow', 'is', null) // Only get units that have been shipped somewhere
      .order('received_date', { ascending: false });

    // Apply filters if provided
    if (destinationFilter) {
      query = query.eq('outflow', destinationFilter);
    }
    if (skuFilter) {
      query = query.eq('model_number', skuFilter);
    }
    if (startDate) {
      query = query.gte('received_date', startDate);
    }
    if (endDate) {
      query = query.lte('received_date', endDate);
    }

    const { data: units, error } = await query;

    if (error) {
      console.error('[Outflow API] Error fetching units:', error);
      return NextResponse.json(
        { error: 'Failed to fetch outflow data' },
        { status: 500 }
      );
    }

    // Group by destination (outflow)
    const destinationGroups: Record<string, any[]> = {};
    const destinationTotals: Record<string, number> = {};
    const skuBreakdownByDestination: Record<string, Record<string, number>> = {};

    // Group by destination and SKU
    units?.forEach(unit => {
      const destination = unit.outflow || 'Unknown';
      const sku = unit.model_number;

      // Initialize destination if not exists
      if (!destinationGroups[destination]) {
        destinationGroups[destination] = [];
        destinationTotals[destination] = 0;
        skuBreakdownByDestination[destination] = {};
      }

      // Add unit to destination group
      destinationGroups[destination].push(unit);
      destinationTotals[destination]++;

      // Add to SKU breakdown
      if (!skuBreakdownByDestination[destination][sku]) {
        skuBreakdownByDestination[destination][sku] = 0;
      }
      skuBreakdownByDestination[destination][sku]++;
    });

    // Calculate total shipped units
    const totalShipped = units?.length || 0;

    // Calculate percentages
    const destinationPercentages: Record<string, number> = {};
    Object.keys(destinationTotals).forEach(destination => {
      destinationPercentages[destination] = totalShipped > 0 
        ? Math.round((destinationTotals[destination] / totalShipped) * 1000) / 10 
        : 0;
    });

    // Sort destinations by count (descending)
    const sortedDestinations = Object.entries(destinationTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([destination, count]) => ({
        destination,
        count,
        percentage: destinationPercentages[destination],
      }));

    // Get SKU totals across all destinations
    const skuTotals: Record<string, number> = {};
    units?.forEach(unit => {
      const sku = unit.model_number;
      skuTotals[sku] = (skuTotals[sku] || 0) + 1;
    });

    const topSkus = Object.entries(skuTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([sku, count]) => ({ sku, count }));

    // Get list of all unique destinations for filtering
    const allDestinations = Object.keys(destinationTotals).sort();

    // Get list of all unique SKUs for filtering
    const allSkus = Array.from(new Set(units?.map(u => u.model_number) || [])).sort();

    // Calculate time-based metrics
    const now = new Date();
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisWeekShipped = units?.filter(u => 
      u.received_date && new Date(u.received_date) >= thisWeek
    ).length || 0;

    const thisMonthShipped = units?.filter(u => 
      u.received_date && new Date(u.received_date) >= thisMonth
    ).length || 0;

    // Most common destination
    const topDestination = sortedDestinations.length > 0 
      ? sortedDestinations[0].destination 
      : 'N/A';

    const response = {
      summary: {
        totalShipped,
        thisWeekShipped,
        thisMonthShipped,
        topDestination,
        destinationCount: allDestinations.length,
      },
      destinationTotals,
      destinationPercentages,
      sortedDestinations,
      destinationGroups,
      skuBreakdownByDestination,
      topSkus,
      allDestinations,
      allSkus,
    };

    console.log('[Outflow API] Success:', {
      totalShipped,
      destinationCount: allDestinations.length,
      skuCount: allSkus.length,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Outflow API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

