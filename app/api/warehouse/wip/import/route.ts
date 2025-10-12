import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { parseWIPExcelFile, validateWIPUnit } from '@/lib/services/wip-excel-parser';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

/**
 * POST /api/warehouse/wip/import
 * Upload and import WIP Excel file
 */
export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;
  
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

    // Create import batch record
    const { data: importBatch, error: batchError } = await supabaseService
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

    // Save file to temp directory
    const buffer = await file.arrayBuffer();
    const tempDir = os.tmpdir();
    tempFilePath = path.join(tempDir, `wip_${importBatch.id}_${fileName}`);
    
    fs.writeFileSync(tempFilePath, Buffer.from(buffer));
    console.log(`💾 Saved temp file: ${tempFilePath}`);

    // Parse Excel file
    console.log('📊 Parsing Excel file...');
    const { units, weeklySummary, stats } = parseWIPExcelFile(tempFilePath);

    console.log(`✅ Parsed ${stats.totalUnits} units from Excel`);
    console.log(`📅 Weekly summary: ${stats.hasWeeklySummary ? 'Found' : 'Not found'}`);

    // Validate and count errors
    let processedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Insert units into database
    for (const unit of units) {
      try {
        const validationErrors = validateWIPUnit(unit);
        if (validationErrors.length > 0) {
          failedCount++;
          errors.push(`${unit.serialNumber}: ${validationErrors.join(', ')}`);
          continue;
        }

        // Insert unit
        await supabaseService.from('warehouse_wip_units').insert({
          serial_number: unit.serialNumber,
          model_number: unit.modelNumber,
          source: unit.source,
          received_date: unit.receivedDate,
          iso_year_week_received: unit.isoYearWeekReceived,
          emg_ship_date: unit.emgShipDate,
          emg_invoice_date: unit.emgInvoiceDate,
          jira_iso_year_week: unit.jiraIsoYearWeek,
          jira_invoice_date: unit.jiraInvoiceDate,
          jira_transfer_iso_week: unit.jiraTransferIsoWeek,
          jira_transfer_date: unit.jiraTransferDate,
          is_wip: unit.isWip,
          is_rma: unit.isRma,
          is_catv_intake: unit.isCatvIntake,
          import_batch_id: importBatch.id,
          raw_data: unit.rawData
        });

        processedCount++;
      } catch (error: any) {
        failedCount++;
        // Handle duplicate serial number
        if (error.code === '23505') {
          errors.push(`${unit.serialNumber}: Duplicate serial number`);
        } else {
          errors.push(`${unit.serialNumber}: ${error.message}`);
        }
      }
    }

    // Insert weekly summary data if available
    if (weeklySummary) {
      console.log('📅 Inserting weekly summary data...');
      
      for (const week of weeklySummary.weeks) {
        try {
          await supabaseService.from('warehouse_wip_weekly_summary').insert({
            iso_year: weeklySummary.isoYear,
            week_number: parseInt(week),
            received_in: weeklySummary.metrics.receivedIn[week] || 0,
            jira_shipped_out: weeklySummary.metrics.jiraShippedOut[week] || 0,
            emg_shipped_out: weeklySummary.metrics.emgShippedOut[week] || 0,
            wip_in_house: weeklySummary.metrics.wipInHouse[week] || 0,
            wip_cumulative: weeklySummary.metrics.wipCumulative[week] || 0,
            import_batch_id: importBatch.id
          });
        } catch (error) {
          console.error(`Warning: Failed to insert week ${week}:`, error);
        }
      }
    }

    // Compute summary stats by stage
    const { data: stageCounts } = await supabaseService
      .from('warehouse_wip_units')
      .select('stage')
      .eq('import_batch_id', importBatch.id);

    const summaryStats = {
      intake: stageCounts?.filter(u => u.stage === 'Intake' || u.stage === 'Other Intake').length || 0,
      wip: stageCounts?.filter(u => u.stage === 'WIP').length || 0,
      rma: stageCounts?.filter(u => u.stage === 'RMA').length || 0,
      outflow: stageCounts?.filter(u => u.stage === 'Outflow').length || 0
    };

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

    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log('🗑️ Cleaned up temp file');
    }

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

    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

