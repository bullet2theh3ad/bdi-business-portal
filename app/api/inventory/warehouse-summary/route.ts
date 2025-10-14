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

    // Note: WIP units table not available yet, using CATV tracking data only

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

    // Simplified CATV totals (no WIP units data yet)
    const catvWipTotals = {
      totalUnits: 0, // Will be populated when WIP units table is available
      byStage: {}, // Will be populated when WIP units table is available
      bySku: {}, // Will be populated when WIP units table is available
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

    // Top CATV SKUs (simplified for now)
    const topCatvSkus: Array<{ sku: string; totalUnits: number; stages: Record<string, number> }> = [];

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
          inventory: catvInventory,
          wipSummary: [], // Will be populated when WIP units table is available
          topSkus: topCatvSkus,
          lastUpdated: catvInventory.length > 0 ? catvInventory[0].lastUpdated : null,
        },
        summary: {
          totalWarehouses: 2, // EMG and CATV
          totalSkus: emgTotals.totalSkus + Object.keys(catvWipTotals.bySku).length,
          totalUnits: emgTotals.totalOnHand + catvWipTotals.totalUnits,
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
