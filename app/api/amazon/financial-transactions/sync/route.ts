import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { amazonFinancialTransactionSyncs, amazonFinancialTransactions, amazonFinancialLineItems, skuMappings, productSkus, users } from '@/lib/db/schema';
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

    // =====================================================
    // STEP 8: Migrate New Data to Legacy Table
    // =====================================================
    console.log('📤 Step 6: Migrating new transactions to amazon_financial_line_items...');
    
    if (transactionsToInsert.length > 0) {
      // Get the transactions we just inserted (by syncId)
      const newTransactions = await db
        .select()
        .from(amazonFinancialTransactions)
        .where(eq(amazonFinancialTransactions.syncId, syncId));
      
      console.log(`   📊 Found ${newTransactions.length} transactions to migrate`);
      
      // DEBUG: Log date range of transactions
      const dates = newTransactions.map(t => t.postedDate).filter(Boolean);
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates.map(d => new Date(d!).getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => new Date(d!).getTime())));
        console.log(`   📅 Transaction date range: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`);
        
        // Sort transactions by date (newest first) and show the most recent ones
        const sortedByDate = [...newTransactions].sort((a, b) => {
          const dateA = a.postedDate ? new Date(a.postedDate).getTime() : 0;
          const dateB = b.postedDate ? new Date(b.postedDate).getTime() : 0;
          return dateB - dateA; // Descending (newest first)
        });
        
        console.log(`   📋 MOST RECENT transactions (showing last 10):`);
        sortedByDate.slice(0, 10).forEach(txn => {
          const fullDateTime = txn.postedDate ? txn.postedDate.toISOString() : 'N/A';
          console.log(`      - Order ${txn.orderId}: ${fullDateTime} | ${txn.sku} | Qty: ${txn.quantity}`);
        });
        
        console.log(`   📋 OLDEST transactions (showing first 5 for comparison):`);
        sortedByDate.slice(-5).forEach(txn => {
          const fullDateTime = txn.postedDate ? txn.postedDate.toISOString() : 'N/A';
          console.log(`      - Order ${txn.orderId}: ${fullDateTime} | ${txn.sku} | Qty: ${txn.quantity}`);
        });
      }
      
      // =====================================================
      // CONSOLIDATE DUPLICATE TRANSACTIONS
      // =====================================================
      // Group by orderId + sku + postedDate and sum all amounts
      // This prevents duplicate line items from tax/charge/refund events
      console.log(`   🔄 Consolidating duplicate transactions...`);
      
      const consolidatedMap = new Map<string, typeof newTransactions[0]>();
      
      newTransactions.forEach(txn => {
        const key = `${txn.orderId}_${txn.sku}_${txn.postedDate?.toISOString()}`;
        
        if (consolidatedMap.has(key)) {
          // Merge with existing record - sum all monetary values
          const existing = consolidatedMap.get(key)!;
          existing.quantity = (existing.quantity || 0) + (txn.quantity || 0);
          existing.itemPrice = String((Number(existing.itemPrice) || 0) + (Number(txn.itemPrice) || 0));
          existing.shippingPrice = String((Number(existing.shippingPrice) || 0) + (Number(txn.shippingPrice) || 0));
          existing.giftWrapPrice = String((Number(existing.giftWrapPrice) || 0) + (Number(txn.giftWrapPrice) || 0));
          existing.itemPromotion = String((Number(existing.itemPromotion) || 0) + (Number(txn.itemPromotion) || 0));
          existing.shippingPromotion = String((Number(existing.shippingPromotion) || 0) + (Number(txn.shippingPromotion) || 0));
          existing.itemTax = String((Number(existing.itemTax) || 0) + (Number(txn.itemTax) || 0));
          existing.shippingTax = String((Number(existing.shippingTax) || 0) + (Number(txn.shippingTax) || 0));
          existing.giftWrapTax = String((Number(existing.giftWrapTax) || 0) + (Number(txn.giftWrapTax) || 0));
          existing.commission = String((Number(existing.commission) || 0) + (Number(txn.commission) || 0));
          existing.fbaFees = String((Number(existing.fbaFees) || 0) + (Number(txn.fbaFees) || 0));
          existing.otherTransactionFees = String((Number(existing.otherTransactionFees) || 0) + (Number(txn.otherTransactionFees) || 0));
          existing.totalFees = String((Number(existing.totalFees) || 0) + (Number(txn.totalFees) || 0));
          existing.grossRevenue = String((Number(existing.grossRevenue) || 0) + (Number(txn.grossRevenue) || 0));
          existing.netRevenue = String((Number(existing.netRevenue) || 0) + (Number(txn.netRevenue) || 0));
          existing.totalTax = String((Number(existing.totalTax) || 0) + (Number(txn.totalTax) || 0));
        } else {
          // First occurrence - add to map
          consolidatedMap.set(key, { ...txn });
        }
      });
      
      const consolidatedTransactions = Array.from(consolidatedMap.values());
      console.log(`   ✓ Consolidated from ${newTransactions.length} to ${consolidatedTransactions.length} unique records`);
      
      // Convert to line items format
      const lineItemsToInsert = consolidatedTransactions.map((txn) => ({
        orderId: txn.orderId || 'UNKNOWN',
        postedDate: txn.postedDate || new Date(),
        transactionType: txn.transactionType,
        amazonSku: txn.sku, // Map 'sku' to 'amazonSku'
        asin: txn.asin,
        bdiSku: txn.sku, // Use same SKU (already mapped)
        productName: txn.productName,
        quantity: txn.quantity || 0,
        unitPrice: txn.unitPrice?.toString() || '0',
        itemPrice: txn.itemPrice?.toString() || '0',
        shippingPrice: txn.shippingPrice?.toString() || '0',
        giftWrapPrice: txn.giftWrapPrice?.toString() || '0',
        itemPromotion: txn.itemPromotion?.toString() || '0',
        shippingPromotion: txn.shippingPromotion?.toString() || '0',
        itemTax: txn.itemTax?.toString() || '0',
        shippingTax: txn.shippingTax?.toString() || '0',
        giftWrapTax: txn.giftWrapTax?.toString() || '0',
        commission: txn.commission?.toString() || '0',
        fbaFees: txn.fbaFees?.toString() || '0',
        otherFees: txn.otherTransactionFees?.toString() || '0',
        totalFees: txn.totalFees?.toString() || '0',
        grossRevenue: txn.grossRevenue?.toString() || '0',
        netRevenue: txn.netRevenue?.toString() || '0',
        totalTax: txn.totalTax?.toString() || '0',
        marketplaceId: txn.marketplaceId,
        currencyCode: txn.currencyCode,
        rawEvent: txn.rawEvent,
      }));
      
      // Filter out duplicates before inserting
      console.log(`   🔍 Checking for existing records...`);
      
      const existingRecords = await db
        .select({
          orderId: amazonFinancialLineItems.orderId,
          postedDate: amazonFinancialLineItems.postedDate,
          amazonSku: amazonFinancialLineItems.amazonSku,
        })
        .from(amazonFinancialLineItems);
      
      // Create a Set of unique keys for fast lookup
      const existingKeys = new Set(
        existingRecords.map(r => 
          `${r.orderId}_${r.postedDate?.toISOString()}_${r.amazonSku}`
        )
      );
      
      // Filter out records that already exist
      const newRecordsOnly = lineItemsToInsert.filter(item => {
        const key = `${item.orderId}_${item.postedDate?.toISOString()}_${item.amazonSku}`;
        return !existingKeys.has(key);
      });
      
      const duplicatesSkipped = lineItemsToInsert.length - newRecordsOnly.length;
      
      if (duplicatesSkipped > 0) {
        console.log(`   ⚠️  Skipped ${duplicatesSkipped} duplicate records`);
      }
      
      console.log(`   📊 ${newRecordsOnly.length} new records to insert`);
      
      // DEBUG: Show dates of new records being inserted
      if (newRecordsOnly.length > 0) {
        const newDates = newRecordsOnly.map(r => r.postedDate).filter(Boolean);
        if (newDates.length > 0) {
          const minNewDate = new Date(Math.min(...newDates.map(d => new Date(d!).getTime())));
          const maxNewDate = new Date(Math.max(...newDates.map(d => new Date(d!).getTime())));
          console.log(`   📅 NEW records date range: ${minNewDate.toISOString().split('T')[0]} to ${maxNewDate.toISOString().split('T')[0]}`);
          
          // Show the new records
          console.log(`   📋 New records being inserted:`);
          newRecordsOnly.forEach(rec => {
            console.log(`      - Order ${rec.orderId}: ${rec.postedDate.toISOString().split('T')[0]} | ${rec.amazonSku} | Qty: ${rec.quantity}`);
          });
        }
      }
      
      // Insert only new records in batches
      const batchSize = 100;
      let migratedCount = 0;
      
      for (let i = 0; i < newRecordsOnly.length; i += batchSize) {
        const batch = newRecordsOnly.slice(i, i + batchSize);
        
        try {
          await db.insert(amazonFinancialLineItems).values(batch);
          migratedCount += batch.length;
          console.log(`   ✓ Migrated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newRecordsOnly.length / batchSize)}`);
        } catch (insertError: any) {
          console.error(`   ❌ Error migrating batch:`, insertError);
          throw insertError; // Re-throw to be caught by outer try-catch
        }
      }
      
      console.log(`   ✅ Migration complete: ${migratedCount} new records added (${duplicatesSkipped} duplicates skipped)`);
    }

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

