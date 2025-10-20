import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { amazonFinancialTransactionSyncs, amazonFinancialTransactions, skuMappings, productSkus, users } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';
import { getAmazonCredentials } from '@/lib/services/amazon-sp-api/config';

/**
 * Amazon Financial Transactions Delta Sync API
 * 
 * Strategy:
 * - First sync: Fetch last 179 days of transaction data
 * - Subsequent syncs: Only fetch new data since last sync
 * - Maps Amazon ASINs to BDI SKUs using sku_mappings table
 * - Stores SKU-level transactions for velocity calculations
 * 
 * POST /api/amazon/financial-transactions/sync
 */

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting Amazon Financial Transactions Delta Sync...');
    
    // =====================================================
    // STEP 1: Authentication & Authorization
    // =====================================================
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookies) => cookies.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    );
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user role (super_admin only)
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser || dbUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: super_admin access required' }, { status: 403 });
    }

    // =====================================================
    // STEP 2: Check Last Sync & Determine Date Range
    // =====================================================
    console.log('📅 Step 1: Determining sync date range...');
    
    const lastSync = await db
      .select()
      .from(amazonFinancialTransactionSyncs)
      .where(eq(amazonFinancialTransactionSyncs.syncStatus, 'completed'))
      .orderBy(desc(amazonFinancialTransactionSyncs.syncCompletedAt))
      .limit(1);

    const today = new Date();
    let startDate: Date;
    let syncType: 'full' | 'delta';

    if (lastSync.length > 0 && lastSync[0].periodEnd) {
      // Delta sync: Start from day after last sync
      const lastSyncEnd = new Date(lastSync[0].periodEnd);
      startDate = new Date(lastSyncEnd.getTime() + 24 * 60 * 60 * 1000); // Next day
      syncType = 'delta';
      console.log(`   ✓ Last sync: ${lastSync[0].periodEnd}`);
      console.log(`   ✓ Delta sync from ${startDate.toISOString().split('T')[0]}`);
    } else {
      // Full sync: Last 179 days (Amazon API limit)
      startDate = new Date(today.getTime() - 179 * 24 * 60 * 60 * 1000);
      syncType = 'full';
      console.log(`   ✓ No previous sync found`);
      console.log(`   ✓ Full sync: last 179 days`);
    }

    const endDate = today;
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`   📊 Sync period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} (${daysDiff} days)`);

    // If no new data to sync, return early
    if (daysDiff <= 0) {
      console.log('   ℹ️  No new data to sync');
      return NextResponse.json({
        success: true,
        message: 'No new data to sync',
        syncType,
        lastSyncDate: lastSync[0]?.periodEnd,
      });
    }

    // =====================================================
    // STEP 3: Create Sync Record
    // =====================================================
    console.log('💾 Step 2: Creating sync record...');
    
    const [syncRecord] = await db
      .insert(amazonFinancialTransactionSyncs)
      .values({
        syncStartedAt: new Date(),
        syncStatus: 'in_progress',
        syncType,
        periodStart: startDate.toISOString().split('T')[0],
        periodEnd: endDate.toISOString().split('T')[0],
        daysSynced: daysDiff,
      })
      .returning();

    console.log(`   ✓ Sync record created: ${syncRecord.id}`);

    // =====================================================
    // STEP 4: Fetch Financial Data from Amazon
    // =====================================================
    console.log('📥 Step 3: Fetching financial data from Amazon SP-API...');
    
    let financialData: any;
    try {
      const credentials = getAmazonCredentials();
      const amazonService = new AmazonSPAPIService(credentials);
      financialData = await amazonService.getFinancialTransactions(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      
      console.log(`   ✓ Financial data fetched successfully`);
      console.log(`   - Orders: ${financialData.summary?.uniqueOrders || 0}`);
      console.log(`   - Revenue: $${financialData.summary?.totalRevenue || 0}`);
      console.log(`   - SKUs: ${financialData.allSKUs?.length || 0}`);
    } catch (error: any) {
      console.error('   ❌ Failed to fetch financial data:', error.message);
      
      // Update sync record with error
      await db
        .update(amazonFinancialTransactionSyncs)
        .set({
          syncStatus: 'failed',
          errorMessage: error.message,
          errorDetails: { error: error.toString() },
          durationSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
        })
        .where(eq(amazonFinancialTransactionSyncs.id, syncRecord.id));

      return NextResponse.json({
        success: false,
        error: 'Failed to fetch financial data from Amazon',
        details: error.message,
      }, { status: 500 });
    }

    // =====================================================
    // STEP 5: Load SKU Mappings (ASIN → BDI SKU)
    // =====================================================
    console.log('🗺️  Step 4: Loading SKU mappings (ASIN → BDI SKU)...');
    
    const mappings = await db
      .select({
        asin: skuMappings.externalIdentifier,
        bdiSkuId: skuMappings.internalSkuId,
        bdiSku: productSkus.sku,
        bdiSkuName: productSkus.name,
      })
      .from(skuMappings)
      .innerJoin(productSkus, eq(skuMappings.internalSkuId, productSkus.id))
      .where(eq(skuMappings.channel, 'amazon_asin'));

    const asinToBdiSku = new Map(
      mappings.map(m => [m.asin, { sku: m.bdiSku, skuName: m.bdiSkuName }])
    );

    console.log(`   ✓ Loaded ${mappings.length} ASIN mappings`);

    // =====================================================
    // STEP 6: Process & Store Transactions
    // =====================================================
    console.log('💾 Step 5: Processing and storing transactions...');
    
    const transactions = financialData.allSKUs || [];
    const transactionsToInsert: any[] = [];
    const skusProcessed = new Set<string>();

    for (const skuData of transactions) {
      const amazonSku = skuData.sku || skuData.bdiSku;
      const asin = skuData.asin;
      
      // Map ASIN to BDI SKU
      let bdiSku = amazonSku;
      let bdiSkuName = skuData.productName;
      
      if (asin && asinToBdiSku.has(asin)) {
        const mapped = asinToBdiSku.get(asin)!;
        bdiSku = mapped.sku;
        bdiSkuName = mapped.skuName || bdiSkuName;
      }

      skusProcessed.add(bdiSku);

      // Create transaction record for sales
      if (skuData.netUnits && skuData.netUnits !== 0) {
        transactionsToInsert.push({
          syncId: syncRecord.id,
          orderId: null, // Aggregated data doesn't have individual order IDs
          postedDate: new Date(), // Use current date as approximation
          transactionType: skuData.netUnits > 0 ? 'sale' : 'refund',
          sku: bdiSku,
          asin: asin || null,
          productName: bdiSkuName,
          quantity: Math.abs(skuData.netUnits),
          unitPrice: skuData.netUnits !== 0 ? (skuData.net / skuData.netUnits) : 0,
          itemPrice: skuData.net || 0,
          totalFees: skuData.fees || 0,
          netRevenue: skuData.net || 0,
          grossRevenue: (skuData.net || 0) + (skuData.fees || 0),
          adSpend: skuData.adSpend || 0,
          rawEvent: skuData,
        });
      }
    }

    console.log(`   📊 Processed ${transactions.length} SKU entries`);
    console.log(`   📦 ${skusProcessed.size} unique BDI SKUs`);
    console.log(`   💾 Inserting ${transactionsToInsert.length} transaction records...`);

    // Insert transactions in batches
    if (transactionsToInsert.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < transactionsToInsert.length; i += batchSize) {
        const batch = transactionsToInsert.slice(i, i + batchSize);
        await db.insert(amazonFinancialTransactions).values(batch);
        console.log(`   ✓ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transactionsToInsert.length / batchSize)}`);
      }
    }

    // =====================================================
    // STEP 7: Update Sync Record as Completed
    // =====================================================
    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    
    await db
      .update(amazonFinancialTransactionSyncs)
      .set({
        syncStatus: 'completed',
        syncCompletedAt: new Date(),
        transactionsFetched: transactions.length,
        transactionsStored: transactionsToInsert.length,
        skusProcessed: skusProcessed.size,
        apiPagesFetched: financialData.metadata?.pagesProcessed || 0,
        durationSeconds,
      })
      .where(eq(amazonFinancialTransactionSyncs.id, syncRecord.id));

    console.log('✅ Sync completed successfully!');
    console.log(`   ⏱️  Duration: ${durationSeconds}s`);

    return NextResponse.json({
      success: true,
      syncId: syncRecord.id,
      syncType,
      periodStart: startDate.toISOString().split('T')[0],
      periodEnd: endDate.toISOString().split('T')[0],
      daysSynced: daysDiff,
      transactionsFetched: transactions.length,
      transactionsStored: transactionsToInsert.length,
      skusProcessed: skusProcessed.size,
      durationSeconds: parseFloat(durationSeconds),
    });

  } catch (error: any) {
    console.error('❌ Sync error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred',
      details: error.stack,
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    error: 'Use POST method to trigger sync',
    usage: {
      method: 'POST',
      endpoint: '/api/amazon/financial-transactions/sync',
      description: 'Syncs Amazon financial transaction data with delta sync (179-day increments)',
    },
  }, { status: 405 });
}

