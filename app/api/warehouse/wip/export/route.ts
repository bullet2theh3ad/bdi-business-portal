import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/warehouse/wip/export
 * Export WIP units as CSV
 * Query params: importId, stage, sku, dateFrom, dateTo
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesArray) => {
            cookiesArray.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const importId = searchParams.get('importId');
    const stage = searchParams.get('stage');
    const sku = searchParams.get('sku');
    const source = searchParams.get('source');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    console.log('📥 Exporting WIP units with filters:', { importId, stage, sku, source, dateFrom, dateTo });

    // Build base query with filters
    const buildQuery = () => {
      let query = supabaseService
        .from('warehouse_wip_units')
        .select('*')
        .order('received_date', { ascending: false });

      if (importId) {
        query = query.eq('import_batch_id', importId);
      }
      if (stage) {
        query = query.eq('stage', stage);
      }
      if (sku) {
        query = query.eq('model_number', sku);
      }
      if (source) {
        query = query.eq('source', source);
      }
      if (dateFrom) {
        query = query.gte('received_date', dateFrom);
      }
      if (dateTo) {
        query = query.lte('received_date', dateTo);
      }

      return query;
    };

    // Fetch ALL units in batches to bypass Supabase 1000-row limit
    console.log('📦 Fetching all units in batches...');
    const BATCH_SIZE = 5000;
    let allUnits: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error } = await buildQuery().range(offset, offset + BATCH_SIZE - 1);
      
      if (error) {
        console.error('Error fetching units:', error);
        return NextResponse.json(
          { error: 'Failed to fetch units' },
          { status: 500 }
        );
      }

      if (!batch || batch.length === 0) {
        hasMore = false;
      } else {
        allUnits = allUnits.concat(batch);
        console.log(`✅ Fetched batch: ${batch.length} units (total so far: ${allUnits.length})`);
        
        if (batch.length < BATCH_SIZE) {
          hasMore = false; // Last batch
        } else {
          offset += BATCH_SIZE;
        }
      }
    }

    const units = allUnits;
    console.log(`✅ Total units fetched: ${units.length}`);

    if (!units || units.length === 0) {
      return NextResponse.json(
        { error: 'No data to export' },
        { status: 404 }
      );
    }

    // Convert to CSV
    const headers = [
      'Serial Number',
      'Model Number',
      'Source',
      'Stage',
      'Received Date',
      'ISO Week Received',
      'Outflow Date',
      'Aging Days',
      'Aging Bucket',
      'Is WIP',
      'Is RMA',
      'Is CATV Intake',
      'EMG Ship Date',
      'Jira Transfer Date',
      'Imported At'
    ];

    // Build CSV rows
    console.log(`📝 Building CSV with ${units.length} units...`);
    const csvRows: string[] = [headers.join(',')];
    
    // Add each unit row
    for (const unit of units) {
      csvRows.push([
        `"${unit.serial_number || ''}"`,
        `"${unit.model_number || ''}"`,
        `"${unit.source || ''}"`,
        `"${unit.stage || ''}"`,
        unit.received_date || '',
        unit.iso_year_week_received || '',
        unit.outflow_date || '',
        unit.aging_days || '',
        `"${unit.aging_bucket || ''}"`,
        unit.is_wip ? 'Yes' : 'No',
        unit.is_rma ? 'Yes' : 'No',
        unit.is_catv_intake ? 'Yes' : 'No',
        unit.emg_ship_date || '',
        unit.jira_transfer_date || '',
        unit.imported_at || ''
      ].join(','));
    }

    console.log(`📊 CSV has ${csvRows.length} rows (including header)`);
    const csvContent = csvRows.join('\n');
    console.log(`📦 CSV content size: ${csvContent.length} characters`);

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `wip_export_${timestamp}.csv`;

    console.log(`✅ Exported ${units.length} units to CSV (${csvRows.length} total rows)`);

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Error in GET /api/warehouse/wip/export:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

