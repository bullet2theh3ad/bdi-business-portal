/**
 * Amazon Financial Data API Endpoint
 * 
 * Fetches real-time financial transaction data from Amazon SP-API
 * 
 * Usage:
 * POST /api/amazon/financial-data
 * Body: { "startDate": "2025-01-01", "endDate": "2025-01-31" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';
import { getAmazonCredentials, getConfigStatus } from '@/lib/services/amazon-sp-api/config';
import { FinancialEventsParser } from '@/lib/services/amazon-sp-api';
import { db } from '@/lib/db/drizzle';
import { skuMappings, productSkus, amazonFinancialLineItems, amazonFinancialSummaries } from '@/lib/db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    // Check if Amazon SP-API is configured
    const status = getConfigStatus();
    if (!status.configured) {
      return NextResponse.json({
        success: false,
        error: 'Amazon SP-API not configured',
        missingFields: status.missingFields,
      }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const { startDate, endDate, includeTransactions } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'startDate and endDate are required',
        example: '{"startDate": "2025-01-01", "endDate": "2025-01-31"}',
      }, { status: 400 });
    }

    // Validate date format
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return NextResponse.json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD format',
      }, { status: 400 });
    }

    if (startDateObj > endDateObj) {
      return NextResponse.json({
        success: false,
        error: 'startDate must be before endDate',
      }, { status: 400 });
    }

    // Calculate date range
    const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log(`[Financial Data] Fetching transactions from ${startDate} to ${endDate} (${daysDiff} days)`);

    // =====================================================
    // CHECK DATABASE FOR EXISTING DATA (DELTA SYNC)
    // =====================================================
    console.log('[Financial Data] Checking database for existing data...');
    
    // Check how many line items we have for this date range
    const existingLineItemsCount = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(amazonFinancialLineItems)
      .where(
        and(
          gte(amazonFinancialLineItems.postedDate, new Date(startDate)),
          lte(amazonFinancialLineItems.postedDate, new Date(endDate))
        )
      )
      .execute();
    
    const lineItemCount = existingLineItemsCount[0]?.count || 0;
    
    // Check if we have a summary for this exact date range
    const existingSummary = await db
      .select()
      .from(amazonFinancialSummaries)
      .where(
        and(
          eq(amazonFinancialSummaries.dateRangeStart, new Date(startDate)),
          eq(amazonFinancialSummaries.dateRangeEnd, new Date(endDate))
        )
      )
      .limit(1)
      .execute();
    
    const hasSummary = existingSummary && existingSummary.length > 0;
    
    // Logic: If we have line items AND a summary, use DB. Otherwise, fetch from API (if within limits).
    const hasCompleteData = lineItemCount > 0 && hasSummary;
    
    // Check if date range exceeds Amazon API limit (180 days)
    const exceedsAPILimit = daysDiff > 180;
    
    if (hasCompleteData) {
      console.log(`[Financial Data] ✅ Found ${lineItemCount} line items + summary in DB for ${startDate} to ${endDate}. Using cached data.`);
    } else if (lineItemCount > 0 && !hasSummary) {
      if (exceedsAPILimit) {
        console.log(`[Financial Data] ⚠️ Found ${lineItemCount} line items but no summary. Date range (${daysDiff} days) exceeds API limit (180 days). Using DB only (ad spend will be $0).`);
      } else {
        console.log(`[Financial Data] ⚠️ Found ${lineItemCount} line items but no summary. Will fetch from API to get ad spend/credits/debits.`);
      }
    } else {
      if (exceedsAPILimit) {
        console.log(`[Financial Data] ❌ No data in DB and date range (${daysDiff} days) exceeds API limit (180 days). Cannot fetch.`);
      } else {
        console.log(`[Financial Data] 🔄 No data in DB. Will fetch from Amazon API.`);
      }
    }
    
    // Only fetch from API if:
    // 1. We don't have complete data (line items + summary)
    // 2. Date range is within API limits (180 days)
    // 3. We either have no data OR we have line items but need summary
    const needsAPIFetch = !hasCompleteData && !exceedsAPILimit && (lineItemCount === 0 || !hasSummary);
    
    const actualStartDate = startDate;
    const actualEndDate = endDate;

    // Initialize Amazon SP-API service
    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);

    // Fetch financial transactions (only if needed)
    let transactions: any[] = [];
    let duration = '0.00';
    
    if (needsAPIFetch) {
      const startTime = Date.now();
      transactions = await amazon.getFinancialTransactions(actualStartDate, actualEndDate);
      duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[Financial Data] Retrieved ${transactions.length} event groups from API in ${duration}s`);
    } else {
      console.log('[Financial Data] Skipping API fetch - using database data only');
      // Set empty transactions array - we'll read from DB instead
      transactions = [];
    }
    
    // =====================================================
    // READ FROM DATABASE FOR REQUESTED DATE RANGE
    // =====================================================
    console.log('[Financial Data] Reading data from database for requested range...');
    const dbLineItems = await db
      .select()
      .from(amazonFinancialLineItems)
      .where(
        and(
          gte(amazonFinancialLineItems.postedDate, new Date(startDate)),
          lte(amazonFinancialLineItems.postedDate, new Date(endDate))
        )
      )
      .execute();
    
    console.log(`[Financial Data] Retrieved ${dbLineItems.length} line items from database`);
    
    // Get the most recent transaction date from the database
    const latestTransaction = await db
      .select({
        latestDate: sql<string>`MAX(posted_date)`,
      })
      .from(amazonFinancialLineItems)
      .execute();
    
    const lastTransactionDate = latestTransaction[0]?.latestDate || null;
    console.log(`[Financial Data] Last transaction date in DB: ${lastTransactionDate}`);
    
    // =====================================================
    // CALCULATE SUMMARY FROM DB OR API
    // =====================================================
    let orderIds: string[];
    let totalRevenue: number;
    let totalTax: number;
    let totalFees: number;
    let totalRefunds: number;
    let totalAdSpend: number;
    let adSpendBreakdown: any;
    let totalChargebacks: number;
    let adjustments: any;
    let adjustmentBreakdown: any;
    let totalCoupons: number;
    let totalTaxRefunded: number;
    let feeBreakdown: any;
    let skuSummary: Map<string, { units: number; revenue: number; fees: number }>;
    let refundSummary: Map<string, { units: number; refundAmount: number }>;

    if (!needsAPIFetch && dbLineItems.length > 0) {
      // Always recalculate from line items for accuracy
      // Revenue, fees, tax, refunds are calculated fresh from line items
      // Ad spend, credits, debits are pulled from overlapping summaries (not in line items)
      console.log('[Financial Data] Recalculating summary from line items for accuracy...');
      
      // Check for overlapping summaries to get ad spend/credits/debits
      const overlappingSummaries = await db
        .select()
        .from(amazonFinancialSummaries)
        .where(
          and(
            gte(amazonFinancialSummaries.dateRangeEnd, new Date(startDate)),
            lte(amazonFinancialSummaries.dateRangeStart, new Date(endDate))
          )
        )
        .execute();
      
      if (overlappingSummaries.length > 0) {
        console.log(`[Financial Data] 📊 Found ${overlappingSummaries.length} overlapping summaries to aggregate ad spend/credits/debits.`);
      }
      
      // Get unique order IDs
      orderIds = Array.from(new Set(dbLineItems.map(item => item.orderId)));
      
      // Aggregate totals from line items
      totalRevenue = dbLineItems
        .filter(item => item.transactionType === 'sale')
        .reduce((sum, item) => sum + parseFloat(String(item.grossRevenue || 0)), 0);
      
      totalTax = dbLineItems
        .reduce((sum, item) => sum + parseFloat(String(item.totalTax || 0)), 0);
      
      totalFees = dbLineItems
        .reduce((sum, item) => sum + parseFloat(String(item.totalFees || 0)), 0);
      
      totalRefunds = Math.abs(dbLineItems
        .filter(item => item.transactionType === 'refund')
        .reduce((sum, item) => sum + parseFloat(String(item.grossRevenue || 0)), 0));
      
      // Aggregate ad spend, chargebacks, coupons, adjustments, tax refunded from overlapping summaries
      if (overlappingSummaries.length > 0) {
        console.log(`[Financial Data] 📊 Aggregating ad spend/credits/debits/tax refunded from ${overlappingSummaries.length} overlapping summaries...`);
        totalAdSpend = overlappingSummaries.reduce((sum, s) => sum + parseFloat(String(s.totalAdSpend || 0)), 0);
        totalChargebacks = overlappingSummaries.reduce((sum, s) => sum + parseFloat(String(s.totalChargebacks || 0)), 0);
        totalCoupons = overlappingSummaries.reduce((sum, s) => sum + parseFloat(String(s.totalCoupons || 0)), 0);
        totalTaxRefunded = overlappingSummaries.reduce((sum, s) => sum + parseFloat(String(s.totalTaxRefunded || 0)), 0);
        adjustments = {
          credits: overlappingSummaries.reduce((sum, s) => sum + parseFloat(String(s.adjustmentCredits || 0)), 0),
          debits: overlappingSummaries.reduce((sum, s) => sum + parseFloat(String(s.adjustmentDebits || 0)), 0),
          net: 0, // Will be calculated below
        };
        adjustments.net = adjustments.credits - adjustments.debits;
      } else {
        // No summaries available - ad spend and tax refunded will be $0
        // Run backfill: Click "Backfill Ad Spend" button on Financial Data page
        totalAdSpend = 0;
        totalChargebacks = 0;
        totalCoupons = 0;
        totalTaxRefunded = 0;
        adjustments = { credits: 0, debits: 0, net: 0 };
      }
      adSpendBreakdown = {};
      adjustmentBreakdown = { credits: [], debits: [] };
      
      // Fee breakdown
      feeBreakdown = {
        commission: dbLineItems.reduce((sum, item) => sum + parseFloat(String(item.commission || 0)), 0),
        fbaFees: dbLineItems.reduce((sum, item) => sum + parseFloat(String(item.fbaFees || 0)), 0),
        otherFees: dbLineItems.reduce((sum, item) => sum + parseFloat(String(item.otherFees || 0)), 0),
      };
      
      // SKU summary
      skuSummary = new Map();
      refundSummary = new Map();
      
      dbLineItems.forEach(item => {
        const sku = item.amazonSku;
        if (!sku) return;
        
        if (item.transactionType === 'sale') {
          const existing = skuSummary.get(sku) || { units: 0, revenue: 0, fees: 0 };
          skuSummary.set(sku, {
            units: existing.units + (item.quantity || 0),
            revenue: existing.revenue + parseFloat(String(item.grossRevenue || 0)),
            fees: existing.fees + parseFloat(String(item.totalFees || 0)),
          });
        } else if (item.transactionType === 'refund') {
          const existing = refundSummary.get(sku) || { units: 0, refundAmount: 0 };
          refundSummary.set(sku, {
            units: existing.units + Math.abs(item.quantity || 0),
            refundAmount: existing.refundAmount + Math.abs(parseFloat(String(item.grossRevenue || 0))),
          });
        }
      });
      
    } else {
      // Parse and analyze the API data
      console.log('[Financial Data] Calculating summary from API response...');
      orderIds = FinancialEventsParser.extractOrderIds(transactions);
      totalRevenue = FinancialEventsParser.calculateTotalRevenue(transactions); // Excludes tax
      totalTax = FinancialEventsParser.calculateTotalTax(transactions); // Tax only
      totalFees = FinancialEventsParser.calculateTotalFees(transactions);
      totalRefunds = FinancialEventsParser.calculateTotalRefunds(transactions);
      totalAdSpend = FinancialEventsParser.calculateTotalAdSpend(transactions);
      adSpendBreakdown = FinancialEventsParser.getAdSpendBreakdown(transactions);
      totalChargebacks = FinancialEventsParser.calculateTotalChargebacks(transactions);
      adjustments = FinancialEventsParser.calculateTotalAdjustments(transactions);
      adjustmentBreakdown = FinancialEventsParser.getAdjustmentBreakdown(transactions);
      totalCoupons = FinancialEventsParser.calculateTotalCoupons(transactions);
      totalTaxRefunded = FinancialEventsParser.calculateTotalTaxRefunded(transactions);
      feeBreakdown = FinancialEventsParser.getFeeBreakdown(transactions);
      skuSummary = FinancialEventsParser.getSKUSummary(transactions);
      refundSummary = FinancialEventsParser.getRefundSummary(transactions);
    }

    // Fetch all SKU mappings from database for lookup
    const allMappings = await db
      .select({
        externalIdentifier: skuMappings.externalIdentifier,
        channel: skuMappings.channel,
        internalSku: productSkus.sku,
      })
      .from(skuMappings)
      .leftJoin(productSkus, eq(skuMappings.internalSkuId, productSkus.id));

    // Create lookup map (external SKU -> internal SKU)
    const skuLookup = new Map<string, string>();
    allMappings.forEach(mapping => {
      if (mapping.externalIdentifier && mapping.internalSku) {
        // Try both with and without channel prefix for flexibility
        skuLookup.set(mapping.externalIdentifier.toLowerCase(), mapping.internalSku);
      }
    });

    // Get ALL SKUs by revenue (sorted) with refund data and BDI SKU mapping
    const allSKUs = Array.from(skuSummary.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([sku, data]) => {
        const refundData = refundSummary.get(sku) || { units: 0, refundAmount: 0 };
        
        // Try to find BDI SKU mapping
        const bdiSku = skuLookup.get(sku.toLowerCase());
        const mappingStatus = bdiSku ? 'mapped' : 
                             (skuLookup.size === 0 ? 'no_mapping' : 'no_sku');
        
        return {
          sku,
          units: data.units,
          revenue: Number(data.revenue.toFixed(2)),
          fees: Number(data.fees.toFixed(2)),
          net: Number((data.revenue - data.fees - (refundData.refundAmount || 0)).toFixed(2)),
          refundedUnits: refundData.units,
          refundAmount: Number(refundData.refundAmount.toFixed(2)),
          netUnits: data.units - refundData.units, // Units after returns
          bdiSku: bdiSku || undefined,
          mappingStatus: mappingStatus as 'mapped' | 'no_mapping' | 'no_sku',
        };
      });
    
    // Get top 10 for the chart
    const topSKUs = allSKUs.slice(0, 10);

    // =====================================================
    // SAVE LINE ITEMS TO DATABASE
    // =====================================================
    console.log('[Financial Data] Saving line items to database...');
    const lineItemsToSave: any[] = [];
    
    // Extract individual line items from raw transactions
    for (const eventGroup of transactions) {
      // Process ShipmentEventList (sales)
      if (eventGroup.ShipmentEventList) {
        for (const shipment of eventGroup.ShipmentEventList) {
          const orderId = shipment.AmazonOrderId || 'UNKNOWN';
          const postedDate = shipment.PostedDate ? new Date(shipment.PostedDate) : new Date();
          
          if (shipment.ShipmentItemList) {
            for (const item of shipment.ShipmentItemList) {
              const amazonSku = item.SellerSKU || 'UNKNOWN';
              const quantity = item.QuantityShipped || 0;
              const bdiSku = skuLookup.get(amazonSku.toLowerCase());
              
              // Calculate amounts from charge lists
              let itemPrice = 0;
              let shippingPrice = 0;
              let itemPromotion = 0;
              let itemTax = 0;
              let shippingTax = 0;
              
              if (item.ItemChargeList) {
                for (const charge of item.ItemChargeList) {
                  const amount = parseFloat(String(charge.ChargeAmount?.CurrencyAmount || '0'));
                  if (charge.ChargeType === 'Principal') {
                    itemPrice += amount;
                  } else if (charge.ChargeType === 'Shipping') {
                    shippingPrice += amount;
                  } else if (charge.ChargeType === 'ShippingChargeback') {
                    itemPromotion += Math.abs(amount);
                  } else if (charge.ChargeType === 'Tax') {
                    itemTax += amount;
                  } else if (charge.ChargeType === 'ShippingTax') {
                    shippingTax += amount;
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
              const totalTax = itemTax + shippingTax;
              
              lineItemsToSave.push({
                orderId,
                postedDate,
                transactionType: 'sale',
                amazonSku,
                asin: null,
                bdiSku: bdiSku || null,
                productName: null,
                quantity,
                unitPrice: quantity > 0 ? (itemPrice / quantity).toFixed(2) : '0',
                itemPrice: itemPrice.toFixed(2),
                shippingPrice: shippingPrice.toFixed(2),
                giftWrapPrice: '0',
                itemPromotion: itemPromotion.toFixed(2),
                shippingPromotion: '0',
                itemTax: itemTax.toFixed(2),
                shippingTax: shippingTax.toFixed(2),
                giftWrapTax: '0',
                commission: commission.toFixed(2),
                fbaFees: fbaFees.toFixed(2),
                otherFees: (totalFees - commission - fbaFees).toFixed(2),
                totalFees: totalFees.toFixed(2),
                grossRevenue: grossRevenue.toFixed(2),
                netRevenue: netRevenue.toFixed(2),
                totalTax: totalTax.toFixed(2),
                marketplaceId: 'ATVPDKIKX0DER',
                currencyCode: 'USD',
                rawEvent: item,
              });
            }
          }
        }
      }
      
      // Process RefundEventList (refunds)
      if (eventGroup.RefundEventList) {
        for (const refund of eventGroup.RefundEventList) {
          const orderId = refund.AmazonOrderId || 'UNKNOWN';
          const postedDate = refund.PostedDate ? new Date(refund.PostedDate) : new Date();
          
          if (refund.ShipmentItemAdjustmentList) {
            for (const item of refund.ShipmentItemAdjustmentList) {
              const amazonSku = item.SellerSKU || 'UNKNOWN';
              const quantity = Math.abs(item.QuantityShipped || 0);
              const bdiSku = skuLookup.get(amazonSku.toLowerCase());
              
              // Calculate refund amount and tax
              let itemPrice = 0;
              let itemTax = 0;
              let shippingTax = 0;
              
              if (item.ItemChargeAdjustmentList) {
                for (const charge of item.ItemChargeAdjustmentList) {
                  const amount = Math.abs(parseFloat(String(charge.ChargeAmount?.CurrencyAmount || '0')));
                  const chargeType = charge.ChargeType;
                  
                  if (chargeType === 'Tax') {
                    itemTax += amount;
                  } else if (chargeType === 'ShippingTax') {
                    shippingTax += amount;
                  } else {
                    // Principal, Shipping, etc.
                    itemPrice += amount;
                  }
                }
              }
              
              const totalTax = itemTax + shippingTax;
              
              lineItemsToSave.push({
                orderId,
                postedDate,
                transactionType: 'refund',
                amazonSku,
                asin: null,
                bdiSku: bdiSku || null,
                productName: null,
                quantity,
                unitPrice: quantity > 0 ? (itemPrice / quantity).toFixed(2) : '0',
                itemPrice: (-itemPrice).toFixed(2),
                shippingPrice: '0',
                giftWrapPrice: '0',
                itemPromotion: '0',
                shippingPromotion: '0',
                itemTax: (-itemTax).toFixed(2),
                shippingTax: (-shippingTax).toFixed(2),
                giftWrapTax: '0',
                commission: '0',
                fbaFees: '0',
                otherFees: '0',
                totalFees: '0',
                grossRevenue: (-itemPrice).toFixed(2),
                netRevenue: (-itemPrice).toFixed(2),
                totalTax: (-totalTax).toFixed(2),
                marketplaceId: 'ATVPDKIKX0DER',
                currencyCode: 'USD',
                rawEvent: item,
              });
            }
          }
        }
      }
    }
    
    // Save to database in batches (with deduplication)
    if (lineItemsToSave.length > 0) {
      // Check for existing records to avoid duplicates
      console.log('[Financial Data] 🔍 Checking for existing records to avoid duplicates...');
      
      const existingRecords = await db
        .select({
          orderId: amazonFinancialLineItems.orderId,
          postedDate: amazonFinancialLineItems.postedDate,
          amazonSku: amazonFinancialLineItems.amazonSku,
        })
        .from(amazonFinancialLineItems)
        .where(
          and(
            gte(amazonFinancialLineItems.postedDate, new Date(startDate)),
            lte(amazonFinancialLineItems.postedDate, new Date(endDate))
          )
        );
      
      // Create a Set of unique keys for fast lookup
      const existingKeys = new Set(
        existingRecords.map(r => 
          `${r.orderId}_${r.postedDate?.toISOString()}_${r.amazonSku}`
        )
      );
      
      // Filter out records that already exist
      const newRecordsOnly = lineItemsToSave.filter(item => {
        const key = `${item.orderId}_${item.postedDate?.toISOString()}_${item.amazonSku}`;
        return !existingKeys.has(key);
      });
      
      const duplicatesSkipped = lineItemsToSave.length - newRecordsOnly.length;
      
      if (duplicatesSkipped > 0) {
        console.log(`[Financial Data] ⚠️  Skipped ${duplicatesSkipped} duplicate records (already in database)`);
      }
      
      console.log(`[Financial Data] 📊 ${newRecordsOnly.length} new records to insert`);
      
      // Insert only new records in batches
      const batchSize = 100;
      let savedCount = 0;
      
      for (let i = 0; i < newRecordsOnly.length; i += batchSize) {
        const batch = newRecordsOnly.slice(i, i + batchSize);
        if (batch.length > 0) {
        await db.insert(amazonFinancialLineItems).values(batch);
        savedCount += batch.length;
          console.log(`[Financial Data] Saved batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newRecordsOnly.length / batchSize)} (${savedCount}/${newRecordsOnly.length} items)`);
        }
      }
      
      console.log(`[Financial Data] ✅ Saved ${savedCount} new line items to database (skipped ${duplicatesSkipped} duplicates)`);
      
      // Save summary for this date range (for caching ad spend, credits, debits)
      if (needsAPIFetch) {
        console.log('[Financial Data] Saving summary to database...');
        await db.insert(amazonFinancialSummaries).values({
          dateRangeStart: new Date(startDate),
          dateRangeEnd: new Date(endDate),
          totalRevenue: totalRevenue.toFixed(2),
          totalTax: totalTax.toFixed(2),
          totalFees: totalFees.toFixed(2),
          totalRefunds: totalRefunds.toFixed(2),
          totalTaxRefunded: totalTaxRefunded.toFixed(2),
          totalAdSpend: totalAdSpend.toFixed(2),
          totalChargebacks: totalChargebacks.toFixed(2),
          totalCoupons: totalCoupons.toFixed(2),
          adjustmentCredits: adjustments.credits.toFixed(2),
          adjustmentDebits: adjustments.debits.toFixed(2),
          uniqueOrders: orderIds.length,
          eventGroups: transactions.length,
        }).onConflictDoUpdate({
          target: [amazonFinancialSummaries.dateRangeStart, amazonFinancialSummaries.dateRangeEnd],
          set: {
            totalRevenue: totalRevenue.toFixed(2),
            totalTax: totalTax.toFixed(2),
            totalFees: totalFees.toFixed(2),
            totalRefunds: totalRefunds.toFixed(2),
            totalTaxRefunded: totalTaxRefunded.toFixed(2),
            totalAdSpend: totalAdSpend.toFixed(2),
            totalChargebacks: totalChargebacks.toFixed(2),
            totalCoupons: totalCoupons.toFixed(2),
            adjustmentCredits: adjustments.credits.toFixed(2),
            adjustmentDebits: adjustments.debits.toFixed(2),
            uniqueOrders: orderIds.length,
            eventGroups: transactions.length,
            updatedAt: new Date(),
          },
        });
        console.log('[Financial Data] ✅ Summary saved to database');
      }
    } else {
      console.log('[Financial Data] No line items to save');
    }

    // Calculate additional metrics
    const netRevenue = totalRevenue - totalFees;
    const profitMargin = totalRevenue > 0 ? ((netRevenue / totalRevenue) * 100) : 0;
    const feePercentage = totalRevenue > 0 ? ((totalFees / totalRevenue) * 100) : 0;
    
    // Calculate TRUE net profit (after all costs)
    const trueNetProfit = totalRevenue - totalFees - totalRefunds - totalAdSpend - totalCoupons - totalChargebacks + adjustments.net;
    const trueNetMargin = totalRevenue > 0 ? ((trueNetProfit / totalRevenue) * 100) : 0;
    
    // Calculate marketing ROI
    const marketingROI = totalAdSpend > 0 ? ((totalRevenue / totalAdSpend) * 100) : 0;

    // Format fee breakdown for response
    const feeBreakdownFormatted = Object.entries(feeBreakdown)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([type, amount]) => ({
        feeType: type,
        amount: Number((amount as number).toFixed(2)),
        percentage: totalFees > 0 ? Number((((amount as number) / totalFees) * 100).toFixed(2)) : 0
      }));

    // Format ad spend breakdown for response
    const adSpendBreakdownFormatted = Object.entries(adSpendBreakdown)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([type, amount]) => ({
        transactionType: type,
        amount: Number((amount as number).toFixed(2)),
        percentage: totalAdSpend > 0 ? Number((((amount as number) / totalAdSpend) * 100).toFixed(2)) : 0
      }));

    const response: any = {
      success: true,
      dateRange: { start: startDate, end: endDate },
      lastTransactionDate: lastTransactionDate,
      performance: {
        durationSeconds: Number(duration),
        recordsPerSecond: Number((orderIds.length / Number(duration)).toFixed(2)),
      },
      summary: {
        eventGroups: transactions.length,
        uniqueOrders: orderIds.length,
        totalRevenue: Number(totalRevenue.toFixed(2)), // Excludes tax
        totalTax: Number(totalTax.toFixed(2)), // Tax collected separately
        totalTaxRefunded: Number(totalTaxRefunded.toFixed(2)), // Tax refunded separately
        totalFees: Number(totalFees.toFixed(2)),
        totalRefunds: Number(totalRefunds.toFixed(2)), // Product refunds only (no tax)
        totalAdSpend: Number(totalAdSpend.toFixed(2)),
        totalChargebacks: Number(totalChargebacks.toFixed(2)),
        totalCoupons: Number(totalCoupons.toFixed(2)),
        adjustmentCredits: Number(adjustments.credits.toFixed(2)),
        adjustmentDebits: Number(adjustments.debits.toFixed(2)),
        adjustmentNet: Number(adjustments.net.toFixed(2)),
        netRevenue: Number(netRevenue.toFixed(2)),
        trueNetProfit: Number(trueNetProfit.toFixed(2)),
        uniqueSKUs: skuSummary.size,
        profitMargin: Number(profitMargin.toFixed(2)),
        trueNetMargin: Number(trueNetMargin.toFixed(2)),
        feePercentage: Number(feePercentage.toFixed(2)),
        refundRate: orderIds.length > 0 ? Number(((refundSummary.size / orderIds.length) * 100).toFixed(2)) : 0,
        marketingROI: Number(marketingROI.toFixed(2)),
      },
      feeBreakdown: feeBreakdownFormatted, // Detailed fee breakdown by type
      adSpendBreakdown: adSpendBreakdownFormatted, // Detailed ad spend breakdown by transaction type
      adjustmentBreakdown: {
        credits: Object.entries(adjustmentBreakdown.credits)
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .map(([type, amount]) => ({
            adjustmentType: type,
            amount: Number((amount as number).toFixed(2)),
            percentage: adjustments.credits > 0 ? Number((((amount as number) / adjustments.credits) * 100).toFixed(2)) : 0
          })),
        debits: Object.entries(adjustmentBreakdown.debits)
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .map(([type, amount]) => ({
            adjustmentType: type,
            amount: Number((amount as number).toFixed(2)),
            percentage: adjustments.debits > 0 ? Number((((amount as number) / adjustments.debits) * 100).toFixed(2)) : 0
          }))
      }, // Detailed adjustment breakdown by type
      topSKUs, // Top 10 for the chart
      allSKUs, // ALL SKUs for the table and export
      metadata: {
        fetchedAt: new Date().toISOString(),
        dateRangeDays: daysDiff,
        apiVersion: '2024-06-19',
      },
    };

    // Include raw transaction data if requested (for detailed exports)
    if (includeTransactions) {
      // If we have API transactions, use them
      if (transactions && transactions.length > 0) {
        response.transactions = transactions;
      } 
      // Otherwise, reconstruct from DB line items
      else if (dbLineItems && dbLineItems.length > 0) {
        console.log('[Financial Data] Reconstructing transactions from DB line items for export...');
        
        // Group line items by order_id to reconstruct transaction structure
        const orderGroups = new Map();
        
        dbLineItems.forEach(item => {
          const orderId = item.orderId;
          if (!orderGroups.has(orderId)) {
            orderGroups.set(orderId, {
              sales: [],
              refunds: []
            });
          }
          
          const group = orderGroups.get(orderId);
          if (item.transactionType === 'sale') {
            group.sales.push(item);
          } else if (item.transactionType === 'refund') {
            group.refunds.push(item);
          }
        });
        
        // Convert to Amazon API format
        const reconstructedTransactions = [];
        
        for (const [orderId, group] of orderGroups.entries()) {
          const eventGroup: any = {};
          
          // Add sales (ShipmentEventList)
          if (group.sales.length > 0) {
            eventGroup.ShipmentEventList = [{
              AmazonOrderId: orderId,
              PostedDate: group.sales[0].postedDate,
              ShipmentItemList: group.sales.map((item: any) => ({
                SellerSKU: item.amazonSku,
                ASIN: item.asin,
                QuantityShipped: item.quantity,
                ItemChargeList: [
                  { ChargeType: 'Principal', ChargeAmount: { CurrencyAmount: parseFloat(String(item.itemPrice || 0)) } },
                  { ChargeType: 'Shipping', ChargeAmount: { CurrencyAmount: parseFloat(String(item.shippingPrice || 0)) } },
                  { ChargeType: 'GiftWrap', ChargeAmount: { CurrencyAmount: parseFloat(String(item.giftWrapPrice || 0)) } },
                  { ChargeType: 'Promotion', ChargeAmount: { CurrencyAmount: -parseFloat(String(item.itemPromotion || 0)) } },
                ],
                ItemFeeList: [
                  { FeeType: 'Commission', FeeAmount: { CurrencyAmount: parseFloat(String(item.commission || 0)) } },
                  { FeeType: 'FBAPerUnitFulfillmentFee', FeeAmount: { CurrencyAmount: parseFloat(String(item.fbaFees || 0)) } },
                  { FeeType: 'Other', FeeAmount: { CurrencyAmount: parseFloat(String(item.otherFees || 0)) } },
                ]
              }))
            }];
          }
          
          // Add refunds (RefundEventList)
          if (group.refunds.length > 0) {
            eventGroup.RefundEventList = [{
              AmazonOrderId: orderId,
              PostedDate: group.refunds[0].postedDate,
              ShipmentItemAdjustmentList: group.refunds.map((item: any) => ({
                SellerSKU: item.amazonSku,
                ASIN: item.asin,
                QuantityShipped: Math.abs(item.quantity || 0),
                ItemChargeAdjustmentList: [
                  { ChargeType: 'Principal', ChargeAmount: { CurrencyAmount: Math.abs(parseFloat(String(item.itemPrice || 0))) } },
                  { ChargeType: 'Tax', ChargeAmount: { CurrencyAmount: Math.abs(parseFloat(String(item.itemTax || 0))) } },
                ],
                ItemFeeAdjustmentList: [
                  { FeeType: 'Commission', FeeAmount: { CurrencyAmount: Math.abs(parseFloat(String(item.commission || 0))) } },
                  { FeeType: 'FBAPerUnitFulfillmentFee', FeeAmount: { CurrencyAmount: Math.abs(parseFloat(String(item.fbaFees || 0))) } },
                ]
              }))
            }];
          }
          
          reconstructedTransactions.push(eventGroup);
        }
        
        response.transactions = reconstructedTransactions;
        console.log(`[Financial Data] Reconstructed ${reconstructedTransactions.length} transaction groups from ${dbLineItems.length} line items`);
      }
    }

    console.log(`[Financial Data] Summary: ${orderIds.length} orders, $${totalRevenue.toFixed(2)} revenue (excl. tax), $${totalTax.toFixed(2)} tax, $${totalFees.toFixed(2)} fees, $${totalRefunds.toFixed(2)} refunds, $${totalAdSpend.toFixed(2)} ads, $${totalCoupons.toFixed(2)} coupons, $${totalChargebacks.toFixed(2)} chargebacks`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Financial Data] Error:', error);
    
    // Handle specific Amazon API errors
    if (error instanceof Error) {
      if (error.message.includes('403')) {
        return NextResponse.json({
          success: false,
          error: 'Access denied. Check your Amazon SP-API permissions for Financial Events API.',
          details: error.message,
        }, { status: 403 });
      }
      
      if (error.message.includes('400')) {
        return NextResponse.json({
          success: false,
          error: 'Bad request. Check your date format and parameters.',
          details: error.message,
        }, { status: 400 });
      }
      
      if (error.message.includes('429')) {
        return NextResponse.json({
          success: false,
          error: 'Rate limit exceeded. Please try again in a few minutes.',
          details: error.message,
        }, { status: 429 });
      }
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Use POST method with startDate and endDate in request body',
    example: {
      method: 'POST',
      body: {
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      }
    }
  }, { status: 405 });
}
