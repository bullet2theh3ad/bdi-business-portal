import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { amazonFinancialTransactionSyncs, amazonFinancialTransactions, skuMappings, productSkus, users } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { AmazonSPAPIService, FinancialEventsParser } from '@/lib/services/amazon-sp-api';
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
      const lastSyncEnd = new Date(lastSync[0].periodEnd);
      const todayStr = today.toISOString().split('T')[0];
      const lastSyncStr = lastSyncEnd.toISOString().split('T')[0];
      
      // If last sync was today, force full re-sync
      if (lastSyncStr === todayStr) {
        console.log(`   ⚠️  Last sync was today (${lastSyncStr}), forcing FULL re-sync`);
        startDate = new Date(today.getTime() - 179 * 24 * 60 * 60 * 1000);
        syncType = 'full';
        
        // Delete old data to avoid duplicates
        console.log(`   🗑️  Clearing old transaction data...`);
        await db.delete(amazonFinancialTransactions).execute();
        console.log(`   ✓ Old data cleared`);
      } else {
        // Delta sync: Start from day after last sync
        startDate = new Date(lastSyncEnd.getTime() + 24 * 60 * 60 * 1000);
        syncType = 'delta';
        console.log(`   ✓ Last sync: ${lastSyncStr}`);
        console.log(`   ✓ Delta sync from ${startDate.toISOString().split('T')[0]}`);
      }
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

    // If no new data to sync (delta mode only), return early
    if (daysDiff <= 0 && syncType === 'delta') {
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
    // STEP 4: Fetch Financial Data from Amazon (raw event groups)
    // =====================================================
    console.log('📥 Step 3: Fetching financial event groups from Amazon SP-API...');
    
    let eventGroups: any[] = [];
    try {
      const credentials = getAmazonCredentials();
      const amazonService = new AmazonSPAPIService(credentials);
      
      // Get raw FinancialEventGroup[] from Amazon
      eventGroups = await amazonService.getFinancialTransactions(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      
      console.log(`   ✓ Financial event groups fetched successfully`);
      console.log(`   - Event Groups: ${eventGroups.length}`);
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
    // STEP 6: Process Event Groups & Extract Order Line Items
    // =====================================================
    console.log('💾 Step 5: Processing event groups and extracting order line items...');
    
    const transactionsToInsert: any[] = [];
    const skusProcessed = new Set<string>();
    let orderItemsProcessed = 0;

    // Process each event group
    for (const eventGroup of eventGroups) {
      // Process ShipmentEventList (orders/sales)
      if (eventGroup.ShipmentEventList) {
        for (const shipment of eventGroup.ShipmentEventList) {
          const orderId = shipment.AmazonOrderId;
          const postedDate = shipment.PostedDate ? new Date(shipment.PostedDate) : new Date();
          
          // Process each item in the shipment
          if (shipment.ShipmentItemList) {
            for (const item of shipment.ShipmentItemList) {
              const amazonSku = item.SellerSKU;
              const asin = item.ASIN;
              const quantity = item.QuantityShipped || 0;
              
              // Map to BDI SKU
              let bdiSku = amazonSku;
              if (asin && asinToBdiSku.has(asin)) {
                bdiSku = asinToBdiSku.get(asin)!.sku;
              }
              
              skusProcessed.add(bdiSku);
              
              // Calculate amounts
              const itemPrice = parseFloat(item.ItemPrice?.CurrencyAmount || '0');
              const itemTax = parseFloat(item.ItemTax?.CurrencyAmount || '0');
              const shippingPrice = parseFloat(item.ShippingPrice?.CurrencyAmount || '0');
              const shippingTax = parseFloat(item.ShippingTax?.CurrencyAmount || '0');
              const itemPromotion = Math.abs(parseFloat(item.PromotionDiscount?.CurrencyAmount || '0'));
              const shippingPromotion = Math.abs(parseFloat(item.ShippingDiscount?.CurrencyAmount || '0'));
              
              // Calculate fees
              let totalFees = 0;
              let commission = 0;
              let fbaFees = 0;
              
              if (item.ItemFeeList) {
                for (const fee of item.ItemFeeList) {
                  const feeAmount = Math.abs(parseFloat(fee.FeeAmount?.CurrencyAmount || '0'));
                  totalFees += feeAmount;
                  
                  if (fee.FeeType?.includes('Commission')) {
                    commission += feeAmount;
                  } else if (fee.FeeType?.includes('FBA')) {
                    fbaFees += feeAmount;
                  }
                }
              }
              
              const grossRevenue = itemPrice + shippingPrice - itemPromotion - shippingPromotion;
              const netRevenue = grossRevenue - totalFees;
              
              transactionsToInsert.push({
                syncId: syncRecord.id,
                orderId,
                postedDate,
                transactionType: 'sale',
                sku: bdiSku,
                asin: asin || null,
                productName: null, // Not available in raw events
                quantity,
                unitPrice: quantity > 0 ? itemPrice / quantity : 0,
                itemPrice,
                shippingPrice,
                itemTax,
                shippingTax,
                itemPromotion,
                shippingPromotion,
                commission,
                fbaFees,
                totalFees,
                grossRevenue,
                netRevenue,
                totalTax: itemTax + shippingTax,
                rawEvent: item,
              });
              
              orderItemsProcessed++;
            }
          }
        }
      }
      
      // Process RefundEventList (refunds)
      if (eventGroup.RefundEventList) {
        for (const refund of eventGroup.RefundEventList) {
          const orderId = refund.AmazonOrderId;
          const postedDate = refund.PostedDate ? new Date(refund.PostedDate) : new Date();
          
          if (refund.ShipmentItemAdjustmentList) {
            for (const item of refund.ShipmentItemAdjustmentList) {
              const amazonSku = item.SellerSKU;
              const asin = item.ASIN;
              const quantity = Math.abs(item.QuantityShipped || 0);
              
              // Map to BDI SKU
              let bdiSku = amazonSku;
              if (asin && asinToBdiSku.has(asin)) {
                bdiSku = asinToBdiSku.get(asin)!.sku;
              }
              
              skusProcessed.add(bdiSku);
              
              const itemPrice = Math.abs(parseFloat(item.ItemPriceAdjustment?.CurrencyAmount || '0'));
              const itemTax = Math.abs(parseFloat(item.ItemTaxAdjustment?.CurrencyAmount || '0'));
              
              transactionsToInsert.push({
                syncId: syncRecord.id,
                orderId,
                postedDate,
                transactionType: 'refund',
                sku: bdiSku,
                asin: asin || null,
                productName: null,
                quantity,
                unitPrice: quantity > 0 ? itemPrice / quantity : 0,
                itemPrice: -itemPrice, // Negative for refunds
                itemTax: -itemTax,
                netRevenue: -itemPrice,
                grossRevenue: -itemPrice,
                totalTax: -itemTax,
                rawEvent: item,
              });
              
              orderItemsProcessed++;
            }
          }
        }
      }
    }

    console.log(`   📊 Processed ${eventGroups.length} event groups`);
    console.log(`   📦 ${orderItemsProcessed} order line items extracted`);
    console.log(`   🏷️  ${skusProcessed.size} unique BDI SKUs`);
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
        transactionsFetched: orderItemsProcessed,
        transactionsStored: transactionsToInsert.length,
        skusProcessed: skusProcessed.size,
        apiPagesFetched: eventGroups.length,
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
      transactionsFetched: orderItemsProcessed,
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

