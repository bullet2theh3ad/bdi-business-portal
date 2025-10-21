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
 * POST /api/inventory/amazon-inventory
 * Save Amazon inventory data fetched from API
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Amazon Inventory API Save: Processing request');
    
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

    // Parse request body
    const body = await request.json();
    const { inventory } = body;

    if (!inventory || !Array.isArray(inventory)) {
      return NextResponse.json({ error: 'Invalid inventory data' }, { status: 400 });
    }

    console.log(`📊 Received ${inventory.length} inventory items`);

    // Create import batch record
    const { data: importBatch, error: importError } = await supabaseService
      .from('amazon_inventory_imports')
      .insert({
        filename: 'API Fetch',
        file_size: JSON.stringify(inventory).length,
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

    // Transform inventory data to database format
    const validUnits = inventory.map((item: any) => ({
      import_batch_id: importBatch.id,
      sku: item.sku || '',
      asin: item.asin || null,
      fnsku: item.fnsku || null,
      condition: item.condition || null,
      afn_total_quantity: item.totalQuantity || 0,
      afn_fulfillable_quantity: item.fulfillableQuantity || 0,
      afn_unsellable_quantity: item.unsellableQuantity || 0,
      afn_reserved_quantity: item.reservedQuantity || 0,
      afn_inbound_quantity: item.inboundQuantity || 0,
    }));

    const totalUnits = validUnits.reduce((sum, item) => sum + item.afn_total_quantity, 0);

    console.log(`✅ ${validUnits.length} units validated`);

    // 🔥 DELETE ALL EXISTING DATA BEFORE INSERTING NEW DATA
    // This ensures each fetch REPLACES the data instead of accumulating it
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
    });

  } catch (error) {
    console.error('❌ Amazon Inventory API Save Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

