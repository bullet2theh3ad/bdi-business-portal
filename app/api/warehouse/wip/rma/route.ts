import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/warehouse/wip/rma
 * Fetch RMA inventory levels per SKU
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const importBatchId = searchParams.get('importBatchId');

    console.log('🔴 RMA API: Fetching RMA inventory data');
    if (importBatchId) {
      console.log(`📦 Filtering by import batch: ${importBatchId}`);
    }

    // Build query for most recent import batch if not specified
    let batchIdToUse = importBatchId;
    
    if (!batchIdToUse) {
      const { data: latestBatch } = await supabaseService
        .from('warehouse_wip_imports')
        .select('id')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();
      
      if (latestBatch) {
        batchIdToUse = latestBatch.id;
        console.log(`📦 Using most recent import batch: ${batchIdToUse}`);
      }
    }

    if (!batchIdToUse) {
      console.log('⚠️  No import batches found');
      return NextResponse.json({
        totalRmaUnits: 0,
        bySku: [],
        bySource: [],
        byStage: [],
        recentRmaUnits: []
      });
    }

    // Fetch RMA units (is_rma = true)
    const { data: rmaUnits, error } = await supabaseService
      .from('warehouse_wip_units')
      .select('*')
      .eq('import_batch_id', batchIdToUse)
      .eq('is_rma', true)
      .order('received_date', { ascending: false });

    if (error) {
      console.error('❌ Error fetching RMA units:', error);
      throw error;
    }

    console.log(`🔴 Found ${rmaUnits?.length || 0} RMA units`);

    // Group by SKU (model_number)
    const bySku = rmaUnits?.reduce((acc, unit) => {
      const sku = unit.model_number || 'Unknown';
      if (!acc[sku]) {
        acc[sku] = {
          sku,
          count: 0,
          units: []
        };
      }
      acc[sku].count++;
      acc[sku].units.push(unit);
      return acc;
    }, {} as Record<string, { sku: string; count: number; units: any[] }>);

    const bySkuArray = Object.values(bySku || {}).sort((a: any, b: any) => b.count - a.count);

    console.log(`📊 RMA Units by SKU:`, bySkuArray.map((s: any) => ({ sku: s.sku, count: s.count })));

    // Group by source
    const bySource = rmaUnits?.reduce((acc, unit) => {
      const source = unit.source || 'Unknown';
      if (!acc[source]) {
        acc[source] = {
          source,
          count: 0
        };
      }
      acc[source].count++;
      return acc;
    }, {} as Record<string, { source: string; count: number }>);

    const bySourceArray = Object.values(bySource || {}).sort((a: any, b: any) => b.count - a.count);

    // Determine stage for each unit
    const unitsWithStage = rmaUnits?.map(unit => {
      let stage = 'Unknown';
      
      if (unit.jira_transfer_date) {
        stage = 'Outflow';
      } else if (unit.jira_invoice_date) {
        stage = 'Jira OUT';
      } else if (unit.emg_ship_date) {
        stage = 'EMG OUT';
      } else if (unit.received_date) {
        stage = 'WIP';
      }
      
      return { ...unit, stage };
    });

    // Group by stage
    const byStage = unitsWithStage?.reduce((acc, unit) => {
      const stage = unit.stage;
      if (!acc[stage]) {
        acc[stage] = {
          stage,
          count: 0
        };
      }
      acc[stage].count++;
      return acc;
    }, {} as Record<string, { stage: string; count: number }>);

    const byStageArray = Object.values(byStage || {});

    // Get recent RMA units (last 20)
    const recentRmaUnits = rmaUnits?.slice(0, 20) || [];

    return NextResponse.json({
      totalRmaUnits: rmaUnits?.length || 0,
      bySku: bySkuArray,
      bySource: bySourceArray,
      byStage: byStageArray,
      recentRmaUnits: recentRmaUnits.map(unit => ({
        serialNumber: unit.serial_number,
        modelNumber: unit.model_number,
        source: unit.source,
        receivedDate: unit.received_date,
        stage: unitsWithStage?.find(u => u.serial_number === unit.serial_number)?.stage
      }))
    });
  } catch (error: any) {
    console.error('❌ RMA API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RMA data', details: error.message },
      { status: 500 }
    );
  }
}

