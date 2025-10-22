import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    let importBatchId = searchParams.get('importBatchId');

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
    
    // If no importBatchId specified, use the most recent completed import
    if (!importBatchId) {
      const { data: latestImport } = await supabaseService
        .from('warehouse_wip_imports')
        .select('id')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();
      
      if (latestImport) {
        importBatchId = latestImport.id;
        console.log(`📦 WIP SKUs: Using most recent import batch: ${importBatchId}`);
      }
    }

    // Use database-level DISTINCT to get all unique SKUs efficiently
    // This avoids the 1000 row limit and processes at the database level
    let query = supabaseService.rpc('get_warehouse_wip_distinct_skus', {
      batch_id: importBatchId || null
    });

    const { data: skuData, error } = await query;

    if (error) {
      console.error('❌ RPC error:', error);
      // Fallback to manual method if RPC doesn't exist
      console.log('📊 Falling back to manual SKU extraction...');
      
      let fallbackQuery = supabaseService
        .from('warehouse_wip_units')
        .select('model_number');

      if (importBatchId) {
        fallbackQuery = fallbackQuery.eq('import_batch_id', importBatchId);
      }

      // Remove limit to get all records
      const { data: units, error: fallbackError } = await fallbackQuery.limit(50000);

      if (fallbackError) {
        throw fallbackError;
      }

      // Extract unique SKUs
      const skuSet = new Set<string>();
      units?.forEach((unit: any) => {
        if (unit.model_number) {
          skuSet.add(unit.model_number);
        }
      });

      const skuList = Array.from(skuSet).sort();
      console.log(`📊 Distinct SKUs from WIP data (fallback): ${skuList.length}`, skuList);
      
      return NextResponse.json({ skus: skuList });
    }

    // Extract SKU values from RPC result
    const skuList = (skuData?.map((s: any) => s.model_number) || [])
      .filter((sku: string) => sku !== null && sku !== '')
      .sort();

    console.log(`📊 Distinct SKUs from WIP data: ${skuList.length}`, skuList);

    return NextResponse.json({ skus: skuList });

  } catch (error: any) {
    console.error('❌ SKUs API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

