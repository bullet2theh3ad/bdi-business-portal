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
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days only!
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
      // Full sync: Last 30 days (manageable chunk size)
      startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      syncType = 'full';
      console.log(`   ✓ No previous sync found`);
      console.log(`   ✓ Full sync: last 30 days`);
    }

    // We want to sync up to today, but request through tomorrow to capture all of today's data
    // Amazon has a reporting delay - requesting only through "today" often misses today's transactions
    const endDate = today; // What we're logically syncing to (for record keeping)
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const apiEndDate = tomorrow; // What we request from Amazon API (to ensure we get all of today)
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`   📊 Sync period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} (${daysDiff} days)`);
    console.log(`   🔍 API request period: ${startDate.toISOString().split('T')[0]} to ${apiEndDate.toISOString().split('T')[0]} (requesting +1 day to capture today's data)`);

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

    // If range is too large, cap at 30 days and warn
    const MAX_DAYS_PER_SYNC = 30;
    if (daysDiff > MAX_DAYS_PER_SYNC) {
      console.log(`   ⚠️  Range too large (${daysDiff} days), capping at ${MAX_DAYS_PER_SYNC} days`);
      startDate = new Date(endDate.getTime() - MAX_DAYS_PER_SYNC * 24 * 60 * 60 * 1000);
      console.log(`   📊 Adjusted period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
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
    // RETURN IMMEDIATELY - Run sync in background
    // =====================================================
    console.log('🚀 Starting background sync process...');
    console.log('   ✓ API will return immediately');
    console.log('   ✓ Sync will continue in background');
    console.log('   ✓ Check sync status via sync record ID');

    // Start background sync (don't await!)
    // Pass apiEndDate (tomorrow) to ensure we get all of today's data
    runBackgroundSync(syncRecord.id, startDate, apiEndDate, startTime).catch(err => {
      console.error('❌ Background sync failed:', err);
    });

    // Return immediately
    return NextResponse.json({
      success: true,
      syncId: syncRecord.id,
      syncType,
      periodStart: startDate.toISOString().split('T')[0],
      periodEnd: endDate.toISOString().split('T')[0],
      daysSynced: daysDiff,
      message: 'Sync started in background. Check status via syncId.',
      status: 'in_progress',
    });

  } catch (error: any) {
    console.error('❌ Sync error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * Background sync function - runs independently
 */
async function runBackgroundSync(
  syncId: string,
  startDate: Date,
  endDate: Date,
  startTime: number
) {
  try {
    // =====================================================
    // STEP 4: Fetch Financial Data from Amazon (raw event groups)
    // =====================================================
    console.log('📥 Step 3: Fetching financial event groups from Amazon SP-API...');
    
    const credentials = getAmazonCredentials();
    const amazonService = new AmazonSPAPIService(credentials);
    
    // Get raw FinancialEventGroup[] from Amazon
    const eventGroups = await amazonService.getFinancialTransactions(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    
    console.log(`   ✓ Financial event groups fetched successfully`);
    console.log(`   - Event Groups: ${eventGroups.length}`);

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
              const amazonSku = item.SellerSKU || 'UNKNOWN';
              const quantity = item.QuantityShipped || 0;
              
              // Use Amazon SKU as BDI SKU for now (ASIN not available in ShipmentItem)
              const bdiSku = amazonSku;
              
              skusProcessed.add(bdiSku);
              
              // Calculate amounts from charge lists
              let itemPrice = 0;
              let shippingPrice = 0;
              let itemPromotion = 0;
              
              if (item.ItemChargeList) {
                for (const charge of item.ItemChargeList) {
                  const amount = parseFloat(String(charge.ChargeAmount?.CurrencyAmount || '0'));
                  if (charge.ChargeType === 'Principal') {
                    itemPrice += amount;
                  } else if (charge.ChargeType === 'Shipping') {
                    shippingPrice += amount;
                  } else if (charge.ChargeType === 'ShippingChargeback') {
                    itemPromotion += Math.abs(amount);
                  }
                }
              }
              
              // Calculate fees
              let totalFees = 0;
              let commission = 0;
              let fbaFees = 0;
              
              if (item.ItemFeeList) {
                for (const fee of item.ItemFeeList) {
                  const feeAmount = Math.abs(parseFloat(String(fee.FeeAmount?.CurrencyAmount || '0')));
                  totalFees += feeAmount;
                  
                  if (fee.FeeType?.includes('Commission')) {
                    commission += feeAmount;
                  } else if (fee.FeeType?.includes('FBA')) {
                    fbaFees += feeAmount;
                  }
                }
              }
              
              const grossRevenue = itemPrice + shippingPrice - itemPromotion;
              const netRevenue = grossRevenue - totalFees;
              
              transactionsToInsert.push({
                syncId: syncId,
                orderId,
                postedDate,
                transactionType: 'sale',
                sku: bdiSku,
                asin: null, // Not available in ShipmentItem
                productName: null, // Not available in raw events
                quantity,
                unitPrice: quantity > 0 ? itemPrice / quantity : 0,
                itemPrice,
                shippingPrice,
                itemPromotion,
                commission,
                fbaFees,
                totalFees,
                grossRevenue,
                netRevenue,
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
              const amazonSku = item.SellerSKU || 'UNKNOWN';
              const quantity = Math.abs(item.QuantityShipped || 0);
              
              // Use Amazon SKU as BDI SKU for now
              const bdiSku = amazonSku;
              
              skusProcessed.add(bdiSku);
              
              // Calculate refund amount from adjustment lists
              let itemPrice = 0;
              if (item.ItemChargeAdjustmentList) {
                for (const charge of item.ItemChargeAdjustmentList) {
                  itemPrice += Math.abs(parseFloat(String(charge.ChargeAmount?.CurrencyAmount || '0')));
                }
              }
              
              transactionsToInsert.push({
                syncId: syncId,
                orderId,
                postedDate,
                transactionType: 'refund',
                sku: bdiSku,
                asin: null,
                productName: null,
                quantity,
                unitPrice: quantity > 0 ? itemPrice / quantity : 0,
                itemPrice: -itemPrice, // Negative for refunds
                netRevenue: -itemPrice,
                grossRevenue: -itemPrice,
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
      .where(eq(amazonFinancialTransactionSyncs.id, syncId));

    console.log('✅ Background sync completed successfully!');
    console.log(`   ⏱️  Duration: ${durationSeconds}s`);
    console.log(`   📦 Transactions stored: ${transactionsToInsert.length}`);
    console.log(`   🏷️  SKUs processed: ${skusProcessed.size}`);

  } catch (error: any) {
    console.error('❌ Background sync error:', error);
    
    // Update sync record with error
    await db
      .update(amazonFinancialTransactionSyncs)
      .set({
        syncStatus: 'failed',
        errorMessage: error.message,
        errorDetails: { error: error.toString() },
        durationSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
      })
      .where(eq(amazonFinancialTransactionSyncs.id, syncId));
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

