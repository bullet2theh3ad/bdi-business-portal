/**
 * Backfill Ad Spend API Endpoint
 * 
 * Fills missing ad spend/credits/debits data by fetching from Amazon API
 * in 30-day chunks and saving to amazon_financial_summaries table
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { amazonFinancialLineItems, amazonFinancialSummaries } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';
import { getAmazonCredentials } from '@/lib/services/amazon-sp-api/config';
import { FinancialEventsParser } from '@/lib/services/amazon-sp-api';

interface DateRange {
  startDate: string;
  endDate: string;
}

async function findMissingDateRanges(): Promise<DateRange[]> {
  // Get the earliest and latest dates from line items
  const dateRange = await db
    .select({
      earliestDate: sql<string>`MIN(DATE(posted_date))`,
      latestDate: sql<string>`MAX(DATE(posted_date))`,
    })
    .from(amazonFinancialLineItems)
    .execute();
  
  if (!dateRange[0]?.earliestDate) {
    return [];
  }
  
  const { earliestDate, latestDate } = dateRange[0];
  
  // Get all existing summaries
  const existingSummaries = await db
    .select({
      startDate: sql<string>`DATE(date_range_start)`,
      endDate: sql<string>`DATE(date_range_end)`,
    })
    .from(amazonFinancialSummaries)
    .execute();
  
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
      });
    }
    
    // Move to next chunk
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }
  
  return chunks;
}

async function backfillChunk(startDate: string, endDate: string) {
  // Initialize Amazon SP-API service
  const credentials = getAmazonCredentials();
  const amazon = new AmazonSPAPIService(credentials);
  
  // Fetch financial transactions
  const transactions = await amazon.getFinancialTransactions(startDate, endDate);
  
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
  
  return {
    startDate,
    endDate,
    adSpend: totalAdSpend,
    revenue: totalRevenue,
    orders: orderIds.length,
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Backfill] Starting ad spend backfill...');
    
    // Find missing date ranges
    const missingRanges = await findMissingDateRanges();
    
    if (missingRanges.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No missing date ranges found. All data is up to date!',
        processed: 0,
        total: 0,
      });
    }
    
    console.log(`[Backfill] Found ${missingRanges.length} date ranges to backfill`);
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    // Process first 5 chunks only (to avoid timeout)
    const chunksToProcess = missingRanges.slice(0, 5);
    
    for (const range of chunksToProcess) {
      try {
        console.log(`[Backfill] Processing ${range.startDate} to ${range.endDate}`);
        const result = await backfillChunk(range.startDate, range.endDate);
        results.push(result);
        successCount++;
        
        // Rate limiting: wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[Backfill] Error processing ${range.startDate} to ${range.endDate}:`, error);
        failCount++;
        results.push({
          startDate: range.startDate,
          endDate: range.endDate,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    const remaining = missingRanges.length - chunksToProcess.length;
    
    return NextResponse.json({
      success: true,
      message: `Processed ${successCount} date ranges successfully`,
      processed: successCount,
      failed: failCount,
      total: missingRanges.length,
      remaining,
      results,
      note: remaining > 0 ? `${remaining} ranges remaining. Run again to continue.` : 'All ranges processed!',
    });
  } catch (error) {
    console.error('[Backfill] Fatal error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to backfill ad spend data',
    }, { status: 500 });
  }
}

