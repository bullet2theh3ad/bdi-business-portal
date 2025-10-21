import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Parse integer from string
 */
function parseInteger(value: string): number {
  const num = parseInt(value);
  return isNaN(num) ? 0 : num;
}

/**
 * POST /api/amazon/inventory/upload
 * Upload and import Amazon FBA Inventory CSV file
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Amazon Inventory Upload API: Processing request');
    
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

    // Check permissions - super_admin only
    if (dbUser.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Super admin access required.' },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`📄 File received: ${file.name} (${file.size} bytes)`);

    // Read file content
    const fileContent = await file.text();
    const lines = fileContent.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    // Create import batch record
    const { data: importBatch, error: importError } = await supabaseService
      .from('amazon_inventory_imports')
      .insert({
        filename: file.name,
        file_size: file.size,
        uploaded_by: authUser.id,
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (importError || !importBatch) {
      console.error('❌ Error creating import batch:', importError);
      return NextResponse.json(
        { error: 'Failed to create import batch' },
        { status: 500 }
      );
    }

    console.log(`✅ Import batch created: ${importBatch.id}`);

    // Parse CSV
    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1);

    console.log(`📊 Headers found:`, headers.slice(0, 10));

    // Find column indices
    const skuIdx = headers.indexOf('sku');
    const fnskuIdx = headers.indexOf('fnsku');
    const asinIdx = headers.indexOf('asin');
    const conditionIdx = headers.indexOf('condition');
    const afnTotalQtyIdx = headers.indexOf('afn-total-quantity');
    const afnFulfillableQtyIdx = headers.indexOf('afn-fulfillable-quantity');
    const afnUnsellableQtyIdx = headers.indexOf('afn-unsellable-quantity');
    const afnReservedQtyIdx = headers.indexOf('afn-reserved-quantity');
    const afnInboundQtyIdx = headers.indexOf('afn-inbound-working-quantity');

    if (skuIdx === -1 || afnTotalQtyIdx === -1) {
      await supabaseService
        .from('amazon_inventory_imports')
        .update({
          status: 'failed',
          error_message: 'Invalid CSV format: missing required columns (sku, afn-total-quantity)',
          completed_at: new Date().toISOString(),
        })
        .eq('id', importBatch.id);

      return NextResponse.json(
        { error: 'Invalid CSV format: missing required columns' },
        { status: 400 }
      );
    }

    console.log(`🔍 Column indices: sku=${skuIdx}, asin=${asinIdx}, qty=${afnTotalQtyIdx}`);

    // Parse inventory units
    const validUnits: any[] = [];
    let totalUnits = 0;
    let failedCount = 0;

    console.log('🔍 Validating units...');
    for (const row of rows) {
      const fields = parseCSVLine(row);
      
      const sku = fields[skuIdx] || '';
      const asin = asinIdx !== -1 ? fields[asinIdx] : '';
      const fnsku = fnskuIdx !== -1 ? fields[fnskuIdx] : '';
      const condition = conditionIdx !== -1 ? fields[conditionIdx] : '';
      const afnTotalQty = parseInteger(fields[afnTotalQtyIdx] || '0');
      const afnFulfillableQty = afnFulfillableQtyIdx !== -1 ? parseInteger(fields[afnFulfillableQtyIdx] || '0') : 0;
      const afnUnsellableQty = afnUnsellableQtyIdx !== -1 ? parseInteger(fields[afnUnsellableQtyIdx] || '0') : 0;
      const afnReservedQty = afnReservedQtyIdx !== -1 ? parseInteger(fields[afnReservedQtyIdx] || '0') : 0;
      const afnInboundQty = afnInboundQtyIdx !== -1 ? parseInteger(fields[afnInboundQtyIdx] || '0') : 0;

      if (!sku) {
        failedCount++;
        continue;
      }

      validUnits.push({
        import_batch_id: importBatch.id,
        sku,
        asin: asin || null,
        fnsku: fnsku || null,
        condition: condition || null,
        afn_total_quantity: afnTotalQty,
        afn_fulfillable_quantity: afnFulfillableQty,
        afn_unsellable_quantity: afnUnsellableQty,
        afn_reserved_quantity: afnReservedQty,
        afn_inbound_quantity: afnInboundQty,
      });

      totalUnits += afnTotalQty;
    }

    console.log(`✅ ${validUnits.length} units validated, ${failedCount} failed`);

    // 🔥 DELETE ALL EXISTING DATA BEFORE INSERTING NEW DATA
    // This ensures each upload REPLACES the data instead of accumulating it
    console.log('🗑️  Deleting all existing Amazon inventory data...');
    const { error: deleteError } = await supabaseService
      .from('amazon_inventory_units')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (deleteError) {
      console.error('❌ Error deleting existing data:', deleteError);
      return NextResponse.json(
        { error: 'Failed to clear existing data before import' },
        { status: 500 }
      );
    }
    console.log('✅ Existing Amazon inventory data cleared');

    // Batch insert units (500 at a time for performance)
    const BATCH_SIZE = 500;
    const totalBatches = Math.ceil(validUnits.length / BATCH_SIZE);
    
    console.log(`📦 Inserting ${validUnits.length} units in ${totalBatches} batches...`);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, validUnits.length);
      const batch = validUnits.slice(start, end);
      
      const { error: insertError } = await supabaseService
        .from('amazon_inventory_units')
        .insert(batch);
      
      if (insertError) {
        console.error(`❌ Error inserting batch ${i + 1}/${totalBatches}:`, insertError);
        
        await supabaseService
          .from('amazon_inventory_imports')
          .update({
            status: 'failed',
            error_message: `Failed to insert batch ${i + 1}: ${insertError.message}`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', importBatch.id);
        
        return NextResponse.json(
          { error: `Failed to insert batch ${i + 1}` },
          { status: 500 }
        );
      }
      
      console.log(`✅ Batch ${i + 1}/${totalBatches} inserted (${batch.length} units)`);
    }

    // Update import batch status
    await supabaseService
      .from('amazon_inventory_imports')
      .update({
        status: 'completed',
        total_skus: validUnits.length,
        total_units: totalUnits,
        completed_at: new Date().toISOString(),
      })
      .eq('id', importBatch.id);

    console.log(`✅ Import completed: ${validUnits.length} SKUs, ${totalUnits} total units`);

    return NextResponse.json({
      success: true,
      importId: importBatch.id,
      totalSkus: validUnits.length,
      totalUnits,
      failedCount,
    });

  } catch (error) {
    console.error('❌ Amazon Inventory Upload Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

