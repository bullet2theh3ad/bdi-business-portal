import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { parseWIPExcelFile, validateWIPUnit } from '@/lib/services/wip-excel-parser';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

/**
 * POST /api/warehouse/wip/import
 * Upload and import WIP Excel file
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 WIP Import API: Processing request');
    
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

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permissions - super_admin, admin, or operations
    if (!['super_admin', 'admin', 'operations'].includes(dbUser.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const shouldReplace = formData.get('replace') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const fileName = file.name;
    if (!fileName.toLowerCase().match(/\.(xlsx|xls)$/)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)' },
        { status: 400 }
      );
    }

    console.log(`📊 Processing WIP file: ${fileName} (${file.size} bytes)`);

    // Check if this filename was already imported (prevent duplicates)
    const { data: existingImport } = await supabaseService
      .from('warehouse_wip_imports')
      .select('id, file_name, completed_at, status')
      .eq('file_name', fileName)
      .eq('status', 'completed')
      .maybeSingle();

    if (existingImport && !shouldReplace) {
      const completedDate = new Date(existingImport.completed_at).toLocaleString();
      console.warn(`⚠️  File "${fileName}" was already imported at ${completedDate}`);
      return NextResponse.json(
        { 
          error: 'Duplicate file',
          message: `This file "${fileName}" has already been imported on ${completedDate}. Would you like to replace it?`,
          existingImportId: existingImport.id
        },
        { status: 409 } // 409 Conflict
      );
    }
    
    // If replacing, delete the existing import first
    if (existingImport && shouldReplace) {
      console.log(`🔄 Replacing existing import: ${existingImport.id}`);
      // The deletion will cascade to warehouse_wip_units and warehouse_wip_weekly_summary
      // due to the ON DELETE CASCADE foreign key constraints
      await supabaseService
        .from('warehouse_wip_imports')
        .delete()
        .eq('id', existingImport.id);
      console.log(`✅ Previous import deleted successfully`);
    }

    // Create import batch record
    const { data: importBatch, error: batchError} = await supabaseService
      .from('warehouse_wip_imports')
      .insert({
        file_name: fileName,
        file_size: file.size,
        status: 'processing',
        imported_by: authUser.id,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (batchError || !importBatch) {
      console.error('❌ Error creating import batch:', batchError);
      return NextResponse.json(
        { error: 'Failed to create import batch' },
        { status: 500 }
      );
    }

    console.log(`📦 Created import batch: ${importBatch.id}`);

    // Read file buffer
    const buffer = await file.arrayBuffer();
    console.log(`📥 File buffer size: ${buffer.byteLength} bytes`);

    // Parse Excel file directly from buffer
    console.log('📊 Parsing Excel file...');
    const { units, weeklySummary, stats } = parseWIPExcelFile(buffer);

    console.log(`✅ Parsed ${stats.totalUnits} units from Excel`);
    console.log(`📅 Weekly summary: ${stats.hasWeeklySummary ? 'Found' : 'Not found'}`);

    // Validate and prepare units for batch insert
    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const validUnits: any[] = [];

    console.log('🔍 Validating units...');
    for (const unit of units) {
      const validationErrors = validateWIPUnit(unit);
      if (validationErrors.length > 0) {
        failedCount++;
        errors.push(`${unit.serialNumber}: ${validationErrors.join(', ')}`);
        continue;
      }

      validUnits.push({
        serial_number: unit.serialNumber,
        model_number: unit.modelNumber,
        source: unit.source || null,
        received_date: unit.receivedDate || null,
        iso_year_week_received: unit.isoYearWeekReceived || null,
        emg_ship_date: unit.emgShipDate || null,
        emg_invoice_date: unit.emgInvoiceDate || null,
        jira_iso_year_week: unit.jiraIsoYearWeek || null,
        jira_invoice_date: unit.jiraInvoiceDate || null,
        jira_transfer_iso_week: unit.jiraTransferIsoWeek || null,
        jira_transfer_date: unit.jiraTransferDate || null,
        is_wip: unit.isWip ?? false,
        is_rma: unit.isRma ?? false,
        is_catv_intake: unit.isCatvIntake ?? false,
        wip_status: unit.wipStatus || null,     // NEW
        outflow: unit.outflow || null,          // NEW
        import_batch_id: importBatch.id,
        raw_data: unit.rawData || null
        // Note: stage, outflow_date, aging_days, aging_bucket are auto-computed by DB trigger
      });
    }

    console.log(`✅ ${validUnits.length} units validated, ${failedCount} failed`);

    // 🔥 DELETE ALL EXISTING DATA BEFORE INSERTING NEW DATA
    // This ensures each upload REPLACES the data instead of accumulating it
    console.log('🗑️  Deleting all existing WIP data...');
    const { error: deleteError } = await supabaseService
      .from('warehouse_wip_units')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (deleteError) {
      console.error('❌ Error deleting existing data:', deleteError);
      return NextResponse.json(
        { error: 'Failed to clear existing data before import' },
        { status: 500 }
      );
    }
    console.log('✅ Existing WIP data cleared');

    // Batch insert units (500 at a time for performance)
    const BATCH_SIZE = 500;
    const totalBatches = Math.ceil(validUnits.length / BATCH_SIZE);
    
    console.log(`💾 Inserting ${validUnits.length} units in ${totalBatches} batches...`);
    
    for (let i = 0; i < validUnits.length; i += BATCH_SIZE) {
      const batch = validUnits.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      
      try {
        console.log(`📦 Batch ${batchNum}/${totalBatches}: Inserting ${batch.length} units...`);
        
        const { error: insertError } = await supabaseService
          .from('warehouse_wip_units')
          .insert(batch);
        
        if (insertError) {
          // If batch fails, try individual inserts for this batch
          console.error(`⚠️  Batch ${batchNum} failed:`, insertError.message);
          console.log(`🔄 Retrying ${batch.length} units individually...`);
          
          for (const unit of batch) {
            try {
              const { error: unitError } = await supabaseService.from('warehouse_wip_units').insert(unit);
              if (unitError) throw unitError;
              processedCount++;
            } catch (error: any) {
              failedCount++;
              if (error.code === '23505') {
                errors.push(`${unit.serial_number}: Duplicate serial number`);
              } else {
                console.error(`❌ Failed to insert ${unit.serial_number}:`, error.message);
                errors.push(`${unit.serial_number}: ${error.message}`);
              }
            }
          }
          console.log(`✅ Individual inserts for batch ${batchNum}: ${batch.length - failedCount} succeeded`);
        } else {
          processedCount += batch.length;
          console.log(`✅ Batch ${batchNum}/${totalBatches} inserted successfully`);
        }
      } catch (error: any) {
        console.error(`❌ Batch ${batchNum} error:`, error);
        failedCount += batch.length;
      }
    }
    
    console.log(`✅ Database insertion complete: ${processedCount} succeeded, ${failedCount} failed`);

    // Insert weekly summary data if available
    if (weeklySummary) {
      console.log(`📅 Inserting weekly summary data (${weeklySummary.weeks.length} weeks)...`);
      
      const weeklyRecords = weeklySummary.weeks.map(week => ({
        iso_year: weeklySummary.isoYear,
        week_number: parseInt(week),
        received_in: weeklySummary.metrics.receivedIn[week] || 0,
        jira_shipped_out: weeklySummary.metrics.jiraShippedOut[week] || 0,
        emg_shipped_out: weeklySummary.metrics.emgShippedOut[week] || 0,
        wip_in_house: weeklySummary.metrics.wipInHouse[week] || 0,
        wip_cumulative: weeklySummary.metrics.wipCumulative[week] || 0,
        import_batch_id: importBatch.id
      }));

      const { error: weeklyError } = await supabaseService
        .from('warehouse_wip_weekly_summary')
        .insert(weeklyRecords);
      
      if (weeklyError) {
        console.error('⚠️  Warning: Failed to insert weekly summary:', weeklyError);
      } else {
        console.log(`✅ Weekly summary inserted successfully`);
      }
    }

    // Compute summary stats by stage using SQL COUNT (works with unlimited rows)
    const { count: totalCount } = await supabaseService
      .from('warehouse_wip_units')
      .select('*', { count: 'exact', head: true })
      .eq('import_batch_id', importBatch.id);

    const { count: wipCount } = await supabaseService
      .from('warehouse_wip_units')
      .select('*', { count: 'exact', head: true })
      .eq('import_batch_id', importBatch.id)
      .eq('stage', 'WIP');

    const { count: rmaCount } = await supabaseService
      .from('warehouse_wip_units')
      .select('*', { count: 'exact', head: true })
      .eq('import_batch_id', importBatch.id)
      .eq('stage', 'RMA');

    const { count: outflowCount } = await supabaseService
      .from('warehouse_wip_units')
      .select('*', { count: 'exact', head: true })
      .eq('import_batch_id', importBatch.id)
      .eq('stage', 'Outflow');

    const summaryStats = {
      intake: totalCount || 0, // Total units received (all of them)
      wip: wipCount || 0,
      rma: rmaCount || 0,
      outflow: outflowCount || 0
    };

    console.log('📊 Summary Stats Calculated:', summaryStats);

    // Update import batch with results
    await supabaseService
      .from('warehouse_wip_imports')
      .update({
        status: failedCount === units.length ? 'failed' : 'completed',
        total_rows: units.length,
        processed_rows: processedCount,
        failed_rows: failedCount,
        completed_at: new Date().toISOString(),
        error_message: errors.length > 0 ? errors.slice(0, 10).join('\n') : null,
        summary_stats: summaryStats
      })
      .eq('id', importBatch.id);

    console.log(`✅ Import completed: ${processedCount} processed, ${failedCount} failed`);

    return NextResponse.json({
      success: true,
      importId: importBatch.id,
      stats: {
        total: units.length,
        processed: processedCount,
        failed: failedCount,
        stages: summaryStats,
        hasWeeklySummary: stats.hasWeeklySummary
      },
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });

  } catch (error: any) {
    console.error('❌ Import error:', error);

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

