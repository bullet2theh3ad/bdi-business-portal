import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting comprehensive data analysis for Ask BDI...');

    // ===== STORAGE BUCKET ANALYSIS =====
    const { data: storageFiles, error: storageError } = await supabase.storage
      .from('organization-documents')
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    let storageAnalysis: any = null;
    if (!storageError && storageFiles) {
      storageAnalysis = {
        totalFiles: storageFiles.length,
        fileTypes: {} as Record<string, number>,
        organizationFolders: {} as Record<string, number>,
        documentCategories: {} as Record<string, number>,
        totalSize: 0,
        recentFiles: storageFiles.slice(0, 10).map(file => ({
          name: file.name,
          size: file.metadata?.size || 0,
          created: file.created_at,
          updated: file.updated_at
        }))
      };

      // Analyze each file
      storageFiles.forEach(file => {
        // File type analysis
        const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
        storageAnalysis.fileTypes[extension] = (storageAnalysis.fileTypes[extension] || 0) + 1;

        // Organization folder analysis
        const orgFolder = file.name.split('/')[0];
        if (!storageAnalysis.organizationFolders[orgFolder]) {
          storageAnalysis.organizationFolders[orgFolder] = { fileCount: 0, totalSize: 0 };
        }
        storageAnalysis.organizationFolders[orgFolder].fileCount++;
        storageAnalysis.organizationFolders[orgFolder].totalSize += file.metadata?.size || 0;

        // Document category analysis
        let category = 'uncategorized';
        if (file.name.includes('/production-files/')) category = 'production-files';
        else if (file.name.includes('/invoices/')) category = 'invoices';
        else if (file.name.includes('/purchase-orders/')) category = 'purchase-orders';
        else if (file.name.includes('/shipments/')) category = 'shipments';
        else if (file.name.includes('/warehouses/')) category = 'warehouses';
        else if (file.name.includes('/rag-documents/')) category = 'rag-documents';
        else if (file.name.includes('/templates/')) category = 'templates';

        storageAnalysis.documentCategories[category] = (storageAnalysis.documentCategories[category] || 0) + 1;
        storageAnalysis.totalSize += file.metadata?.size || 0;
      });
    }

    // ===== DATABASE SCHEMA ANALYSIS =====
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_info');

    let schemaAnalysis = null;
    if (!tablesError && tables) {
      schemaAnalysis = {
        totalTables: tables.length,
        tableDetails: tables
      };
    }

    // ===== BUSINESS DATA ANALYSIS =====
    
    // Organizations analysis
    const { data: organizations, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, code, type, cpfr_contacts');

    // CPFR Forecasts analysis
    const { data: forecasts, error: forecastsError } = await supabase
      .from('sales_forecasts')
      .select(`
        id, delivery_week, quantity, status,
        sales_signal, factory_signal, transit_signal, warehouse_signal,
        custom_exw_date, estimated_transit_start, estimated_warehouse_arrival, confirmed_delivery_date,
        date_change_history, created_at, sku_id
      `);

    // Shipments analysis
    const { data: shipments, error: shipmentsError } = await supabase
      .from('shipments')
      .select(`
        id, shipment_number, status, forecast_id,
        sales_signal, factory_signal, transit_signal, warehouse_signal,
        notes, created_at
      `);

    // Invoices analysis
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, customer_organization_id, total_amount, created_at');

    // Production Files analysis
    const { data: productionFiles, error: prodFilesError } = await supabase
      .from('production_files')
      .select('id, file_name, file_type, organization_id, bdi_shipment_number, created_at');

    const businessAnalysis = {
      organizations: {
        total: organizations?.length || 0,
        byType: {} as Record<string, number>,
        withCpfrContacts: organizations?.filter(o => o.cpfr_contacts).length || 0
      },
      forecasts: {
        total: forecasts?.length || 0,
        withExwDates: forecasts?.filter(f => f.custom_exw_date).length || 0,
        withDateChanges: forecasts?.filter(f => f.date_change_history && f.date_change_history.length > 0).length || 0,
        signalDistribution: {
          sales: {} as Record<string, number>,
          factory: {} as Record<string, number>,
          transit: {} as Record<string, number>,
          warehouse: {} as Record<string, number>
        }
      },
      shipments: {
        total: shipments?.length || 0,
        withForecastLinks: shipments?.filter(s => s.forecast_id).length || 0,
        statusDistribution: {} as Record<string, number>
      },
      invoices: {
        total: invoices?.length || 0,
        statusDistribution: {} as Record<string, number>,
        totalValue: invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0
      },
      productionFiles: {
        total: productionFiles?.length || 0,
        typeDistribution: {} as Record<string, number>,
        withShipmentLinks: productionFiles?.filter(pf => pf.bdi_shipment_number).length || 0
      }
    };

    // Analyze organization types
    organizations?.forEach(org => {
      businessAnalysis.organizations.byType[org.type] = 
        (businessAnalysis.organizations.byType[org.type] || 0) + 1;
    });

    // Analyze CPFR signals
    forecasts?.forEach(forecast => {
      ['sales', 'factory', 'transit', 'warehouse'].forEach(type => {
        const signal = (forecast as any)[`${type}_signal`];
        if (signal) {
          const signalDist = (businessAnalysis.forecasts.signalDistribution as any)[type];
          signalDist[signal] = (signalDist[signal] || 0) + 1;
        }
      });
    });

    // Analyze shipment status
    shipments?.forEach(shipment => {
      businessAnalysis.shipments.statusDistribution[shipment.status] = 
        (businessAnalysis.shipments.statusDistribution[shipment.status] || 0) + 1;
    });

    // Analyze invoice status
    invoices?.forEach(invoice => {
      businessAnalysis.invoices.statusDistribution[invoice.status] = 
        (businessAnalysis.invoices.statusDistribution[invoice.status] || 0) + 1;
    });

    // Analyze production file types
    productionFiles?.forEach(file => {
      businessAnalysis.productionFiles.typeDistribution[file.file_type] = 
        (businessAnalysis.productionFiles.typeDistribution[file.file_type] || 0) + 1;
    });

    // ===== COMPILE FINAL RESULTS =====
    const results = {
      timestamp: new Date().toISOString(),
      summary: {
        totalStorageFiles: storageAnalysis?.totalFiles || 0,
        totalDatabaseTables: schemaAnalysis?.totalTables || 0,
        totalOrganizations: businessAnalysis.organizations.total,
        totalForecasts: businessAnalysis.forecasts.total,
        totalShipments: businessAnalysis.shipments.total,
        totalInvoices: businessAnalysis.invoices.total,
        totalProductionFiles: businessAnalysis.productionFiles.total
      },
      storageAnalysis,
      schemaAnalysis,
      businessAnalysis
    };

    console.log('✅ Comprehensive analysis complete!');
    console.log('📊 Summary:', results.summary);

    return NextResponse.json(results, { 
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache' 
      } 
    });

  } catch (error) {
    console.error('❌ Error in comprehensive analysis:', error);
    return NextResponse.json(
      { error: 'Analysis failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Create RPC function for table info (if not exists)
async function createTableInfoFunction() {
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION get_table_info()
    RETURNS TABLE(
      table_name text,
      column_count bigint,
      estimated_rows bigint,
      table_size text
    )
    LANGUAGE sql
    AS $$
      SELECT 
        t.table_name::text,
        COUNT(c.column_name) as column_count,
        COALESCE(s.n_tup_ins, 0) as estimated_rows,
        pg_size_pretty(pg_total_relation_size(pgc.oid)) as table_size
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c ON c.table_name = t.table_name
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
      LEFT JOIN pg_class pgc ON pgc.relname = t.table_name
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT LIKE 'pg_%'
        AND t.table_name NOT LIKE '_prisma%'
      GROUP BY t.table_name, s.n_tup_ins, pgc.oid
      ORDER BY estimated_rows DESC NULLS LAST;
    $$;
  `;

  try {
    await supabase.rpc('exec', { sql: createFunctionSQL });
    console.log('✅ Table info function created');
  } catch (error) {
    console.log('ℹ️ Table info function may already exist');
  }
}


