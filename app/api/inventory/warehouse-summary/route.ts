import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, emgInventoryTracking, catvInventoryTracking } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get EMG Inventory Summary
    const emgInventory = await db
      .select({
        model: emgInventoryTracking.model,
        description: emgInventoryTracking.description,
        location: emgInventoryTracking.location,
        qtyOnHand: emgInventoryTracking.qtyOnHand,
        qtyAllocated: emgInventoryTracking.qtyAllocated,
        qtyBackorder: emgInventoryTracking.qtyBackorder,
        netStock: emgInventoryTracking.netStock,
        lastUpdated: emgInventoryTracking.lastUpdated,
      })
      .from(emgInventoryTracking)
      .orderBy(desc(emgInventoryTracking.uploadDate));

    // Get CATV Inventory Summary (from CATV tracking table)
    const catvInventory = await db
      .select({
        weekNumber: catvInventoryTracking.weekNumber,
        weekDate: catvInventoryTracking.weekDate,
        receivedIn: catvInventoryTracking.receivedIn,
        shippedJiraOut: catvInventoryTracking.shippedJiraOut,
        shippedEmgOut: catvInventoryTracking.shippedEmgOut,
        wipInHouse: catvInventoryTracking.wipInHouse,
        lastUpdated: catvInventoryTracking.lastUpdated,
      })
      .from(catvInventoryTracking)
      .orderBy(desc(catvInventoryTracking.uploadDate));

    // Get CATV WIP Units Summary (from WIP flow table)
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

    // Get ALL WIP units for CATV data (using pagination to bypass 1000-row limit)
    console.log('📦 Fetching all WIP units in batches...');
    const BATCH_SIZE = 1000; // Supabase max rows per request
    let allWipUnits: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error } = await supabaseService
        .from('warehouse_wip_units')
        .select('*')
        .range(offset, offset + BATCH_SIZE - 1)
        .order('received_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching WIP units batch:', error);
        break;
      }

      if (!batch || batch.length === 0) {
        hasMore = false;
      } else {
        allWipUnits = allWipUnits.concat(batch);
        console.log(`✅ Fetched WIP batch: ${batch.length} units (total so far: ${allWipUnits.length})`);
        
        if (batch.length < BATCH_SIZE) {
          hasMore = false; // Last batch
        } else {
          offset += BATCH_SIZE;
        }
      }
    }

    const wipUnits = allWipUnits;
    console.log(`✅ Total WIP units fetched: ${wipUnits.length}`);

    // Calculate EMG totals
    const emgTotals = {
      totalSkus: emgInventory.length,
      totalOnHand: emgInventory.reduce((sum, item) => sum + (item.qtyOnHand || 0), 0),
      totalAllocated: emgInventory.reduce((sum, item) => sum + (item.qtyAllocated || 0), 0),
      totalBackorder: emgInventory.reduce((sum, item) => sum + (item.qtyBackorder || 0), 0),
      totalNetStock: emgInventory.reduce((sum, item) => sum + (item.netStock || 0), 0),
    };

    // Calculate CATV totals from tracking table
    const catvTotals = {
      totalWeeks: catvInventory.length,
      totalReceivedIn: catvInventory.reduce((sum, item) => sum + (item.receivedIn || 0), 0),
      totalShippedJiraOut: catvInventory.reduce((sum, item) => sum + (item.shippedJiraOut || 0), 0),
      totalShippedEmgOut: catvInventory.reduce((sum, item) => sum + (item.shippedEmgOut || 0), 0),
      totalWipInHouse: catvInventory.reduce((sum, item) => sum + (item.wipInHouse || 0), 0),
    };

    // Calculate CATV WIP totals from actual WIP units data
    const catvWipTotals = {
      totalUnits: wipUnits?.length || 0,
      byStage: (wipUnits || []).reduce((acc: Record<string, number>, unit: any) => {
        const stage = unit.stage || 'Unknown';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {}),
      bySku: (wipUnits || []).reduce((acc: Record<string, number>, unit: any) => {
        const sku = unit.model_number || 'Unknown';
        acc[sku] = (acc[sku] || 0) + 1;
        return acc;
      }, {}),
      bySource: (wipUnits || []).reduce((acc: Record<string, number>, unit: any) => {
        const source = unit.source || 'Unknown';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {}),
    };

    // Calculate CATV metrics like the WIP dashboard
    const catvMetrics = {
      totalIntake: (wipUnits || []).length, // Total units received
      activeWip: (wipUnits || []).filter((unit: any) => unit.stage === 'WIP').length,
      rma: (wipUnits || []).filter((unit: any) => unit.stage === 'RMA').length,
      outflow: (wipUnits || []).filter((unit: any) => unit.stage === 'Outflow').length,
      avgAging: (wipUnits || []).reduce((sum: number, unit: any) => sum + (unit.aging_days || 0), 0) / (wipUnits?.length || 1),
    };

    // Top EMG SKUs by quantity
    const topEmgSkus = emgInventory
      .sort((a, b) => (b.qtyOnHand || 0) - (a.qtyOnHand || 0))
      .slice(0, 10)
      .map(item => ({
        model: item.model,
        description: item.description,
        location: item.location,
        qtyOnHand: item.qtyOnHand || 0,
        netStock: item.netStock || 0,
      }));

    // Top CATV SKUs by WIP units
    const topCatvSkus = Object.entries(catvWipTotals.bySku)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([sku, count]) => ({
        sku,
        totalUnits: count,
        stages: (wipUnits || [])
          .filter((unit: any) => unit.model_number === sku)
          .reduce((acc: Record<string, number>, unit: any) => {
            const stage = unit.stage || 'Unknown';
            acc[stage] = (acc[stage] || 0) + 1;
            return acc;
          }, {}),
      }));

    return NextResponse.json({
      success: true,
      data: {
        emg: {
          totals: emgTotals,
          inventory: emgInventory,
          topSkus: topEmgSkus,
          lastUpdated: emgInventory.length > 0 ? emgInventory[0].lastUpdated : null,
        },
        catv: {
          totals: catvTotals,
          wipTotals: catvWipTotals,
          metrics: catvMetrics,
          inventory: catvInventory,
          wipSummary: wipUnits || [],
          topSkus: topCatvSkus,
          lastUpdated: catvInventory.length > 0 ? catvInventory[0].lastUpdated : null,
        },
        summary: {
          totalWarehouses: 2, // EMG and CATV
          totalSkus: emgTotals.totalSkus + Object.keys(catvWipTotals.bySku).length,
          totalUnits: emgTotals.totalOnHand + catvMetrics.activeWip, // EMG On Hand + CATV Active WIP (not total intake)
          lastUpdated: Math.max(
            emgInventory.length > 0 ? new Date(emgInventory[0].lastUpdated || 0).getTime() : 0,
            catvInventory.length > 0 ? new Date(catvInventory[0].lastUpdated || 0).getTime() : 0
          ),
        }
      }
    });

  } catch (error) {
    console.error('Error fetching warehouse summary:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
