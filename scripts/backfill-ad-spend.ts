/**
 * Backfill Ad Spend Script
 * 
 * This script fills missing ad spend/credits/debits data by:
 * 1. Finding date ranges with line items but no summary
 * 2. Fetching data from Amazon API in small chunks (30 days max)
 * 3. Saving summaries to amazon_financial_summaries table
 * 
 * Run: node --loader ts-node/esm scripts/backfill-ad-spend.ts
 * Or better: Create API endpoint and run via UI button
 */

import { db } from '../lib/db/drizzle.js';
import { amazonFinancialLineItems, amazonFinancialSummaries } from '../lib/db/schema';
import { sql } from 'drizzle-orm';
import { AmazonSPAPIService } from '../lib/services/amazon-sp-api';
import { getAmazonCredentials } from '../lib/services/amazon-sp-api/config';
import { FinancialEventsParser } from '../lib/services/amazon-sp-api';

interface DateRange {
  startDate: string;
  endDate: string;
  hasLineItems: boolean;
  hasSummary: boolean;
}

async function findMissingDateRanges(): Promise<DateRange[]> {
  console.log('🔍 Finding date ranges with line items but no summary...\n');
  
  // Get the earliest and latest dates from line items
  const dateRange = await db
    .select({
      earliestDate: sql<string>`MIN(DATE(posted_date))`,
      latestDate: sql<string>`MAX(DATE(posted_date))`,
    })
    .from(amazonFinancialLineItems)
    .execute();
  
  if (!dateRange[0]?.earliestDate) {
    console.log('❌ No line items found in database');
    return [];
  }
  
  const { earliestDate, latestDate } = dateRange[0];
  console.log(`📅 Line items date range: ${earliestDate} to ${latestDate}\n`);
  
  // Get all existing summaries
  const existingSummaries = await db
    .select({
      startDate: sql<string>`DATE(date_range_start)`,
      endDate: sql<string>`DATE(date_range_end)`,
    })
    .from(amazonFinancialSummaries)
    .execute();
  
  console.log(`📊 Found ${existingSummaries.length} existing summaries\n`);
  
  // Generate 30-day chunks from earliest to latest
  const chunks: DateRange[] = [];
  const start = new Date(earliestDate);
  const end = new Date(latestDate);
  
  let currentStart = new Date(start);
  
  while (currentStart <= end) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + 29); // 30-day chunks
    
    if (currentEnd > end) {
      currentEnd.setTime(end.getTime());
    }
    
    const startStr = currentStart.toISOString().split('T')[0];
    const endStr = currentEnd.toISOString().split('T')[0];
    
    // Check if we already have a summary for this exact range
    const hasSummary = existingSummaries.some(
      s => s.startDate === startStr && s.endDate === endStr
    );
    
    if (!hasSummary) {
      chunks.push({
        startDate: startStr,
        endDate: endStr,
        hasLineItems: true,
        hasSummary: false,
      });
    }
    
    // Move to next chunk
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }
  
  return chunks;
}

async function backfillChunk(startDate: string, endDate: string): Promise<boolean> {
  try {
    console.log(`\n📥 Fetching data for ${startDate} to ${endDate}...`);
    
    // Initialize Amazon SP-API service
    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);
    
    // Fetch financial transactions
    const transactions = await amazon.getFinancialTransactions(startDate, endDate);
    console.log(`   Retrieved ${transactions.length} event groups`);
    
    // Parse and calculate summary
    const totalRevenue = FinancialEventsParser.calculateTotalRevenue(transactions);
    const totalTax = FinancialEventsParser.calculateTotalTax(transactions);
    const totalFees = FinancialEventsParser.calculateTotalFees(transactions);
    const totalRefunds = FinancialEventsParser.calculateTotalRefunds(transactions);
    const totalAdSpend = FinancialEventsParser.calculateTotalAdSpend(transactions);
    const totalChargebacks = FinancialEventsParser.calculateTotalChargebacks(transactions);
    const totalCoupons = FinancialEventsParser.calculateTotalCoupons(transactions);
    const adjustments = FinancialEventsParser.calculateTotalAdjustments(transactions);
    const orderIds = FinancialEventsParser.extractOrderIds(transactions);
    
    console.log(`   💰 Ad Spend: $${totalAdSpend.toFixed(2)}`);
    console.log(`   💵 Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`   📦 Orders: ${orderIds.length}`);
    
    // Save summary to database
    await db.insert(amazonFinancialSummaries).values({
      dateRangeStart: new Date(startDate),
      dateRangeEnd: new Date(endDate),
      totalRevenue: totalRevenue.toFixed(2),
      totalTax: totalTax.toFixed(2),
      totalFees: totalFees.toFixed(2),
      totalRefunds: totalRefunds.toFixed(2),
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
    
    console.log(`   ✅ Summary saved to database`);
    
    return true;
  } catch (error) {
    console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Amazon Ad Spend Backfill Script\n');
  console.log('=' .repeat(60));
  
  // Find missing date ranges
  const missingRanges = await findMissingDateRanges();
  
  if (missingRanges.length === 0) {
    console.log('\n✅ No missing date ranges found. All data is up to date!');
    process.exit(0);
  }
  
  console.log(`\n📋 Found ${missingRanges.length} date ranges to backfill:\n`);
  missingRanges.forEach((range, i) => {
    console.log(`   ${i + 1}. ${range.startDate} to ${range.endDate}`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('⏳ Starting backfill process...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < missingRanges.length; i++) {
    const range = missingRanges[i];
    console.log(`\n[${i + 1}/${missingRanges.length}] Processing ${range.startDate} to ${range.endDate}`);
    
    const success = await backfillChunk(range.startDate, range.endDate);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Rate limiting: wait 2 seconds between requests
    if (i < missingRanges.length - 1) {
      console.log('   ⏱️  Waiting 2s for rate limiting...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Backfill Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📦 Total: ${missingRanges.length}`);
  console.log('=' .repeat(60));
  
  if (failCount > 0) {
    console.log('\n⚠️  Some chunks failed. You can re-run this script to retry.');
    process.exit(1);
  } else {
    console.log('\n🎉 Backfill complete! All ad spend data is now in the database.');
    process.exit(0);
  }
}

// Run the script
main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

