import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { productSkus } from '@/lib/db/schema';
import { sql, inArray } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const warehouse = searchParams.get('warehouse'); // 'EMG' or 'CATV'

    if (!warehouse || !['EMG', 'CATV'].includes(warehouse)) {
      return NextResponse.json(
        { error: 'Invalid warehouse parameter. Must be EMG or CATV.' },
        { status: 400 }
      );
    }

    console.log(`[Sales Velocity] Fetching ${warehouse} inventory...`);

    if (warehouse === 'CATV') {
      // Get CATV data from warehouse_wip_units (Active WIP only)
      const { data: wipData, error } = await supabase
        .from('warehouse_wip_units')
        .select('serial_number, model_number, source, stage, is_wip')
        .eq('is_wip', true);

      if (error) {
        console.error('[Sales Velocity] Supabase error:', error);
        throw new Error(`Supabase error: ${error.message}`);
      }

      // Group by model_number and count unique serial numbers
      const skuMap = new Map<string, Set<string>>();
      
      for (const item of wipData || []) {
        if (!item.model_number) continue;
        if (!skuMap.has(item.model_number)) {
          skuMap.set(item.model_number, new Set());
        }
        if (item.serial_number) {
          skuMap.get(item.model_number)!.add(item.serial_number);
        }
      }

      // Get standard costs for SKUs
      const skus = Array.from(skuMap.keys());
      let skuCosts: any[] = [];
      
      if (skus.length > 0) {
        skuCosts = await db
          .select({
            sku: productSkus.sku,
            standardCost: productSkus.standardCost,
          })
          .from(productSkus)
          .where(inArray(productSkus.sku, skus));
      }

      const costMap = new Map(skuCosts.map(s => [s.sku, parseFloat(s.standardCost || '0')]));

      // Build SKU details
      const skuDetails = Array.from(skuMap.entries()).map(([sku, serialNumbers]) => {
        const units = serialNumbers.size;
        const standardCost = costMap.get(sku) || null;
        const totalValue = standardCost ? standardCost * units : 0;

        return {
          sku,
          units,
          standardCost,
          totalValue,
        };
      });

      const totalUnits = skuDetails.reduce((sum, item) => sum + item.units, 0);
      const totalCost = skuDetails.reduce((sum, item) => sum + item.totalValue, 0);

      console.log(`[Sales Velocity] CATV: ${skuDetails.length} SKUs, ${totalUnits} units, $${totalCost.toFixed(2)} total value`);

      return NextResponse.json({
        warehouseName: 'CATV',
        totalSKUs: skuDetails.length,
        totalUnits,
        totalCost,
        skuDetails: skuDetails.sort((a, b) => b.units - a.units),
      });
    } else {
      // EMG - Get from EMG inventory reports
      // For now, return placeholder - will implement based on existing EMG data structure
      console.log('[Sales Velocity] EMG inventory fetch not yet implemented');
      
      return NextResponse.json({
        warehouseName: 'EMG',
        totalSKUs: 0,
        totalUnits: 0,
        totalCost: 0,
        skuDetails: [],
      });
    }
  } catch (error: any) {
    console.error('[Sales Velocity] Error fetching warehouse inventory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch warehouse inventory', details: error.message },
      { status: 500 }
    );
  }
}

