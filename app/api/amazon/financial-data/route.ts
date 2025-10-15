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

    // Check date range (Amazon API has limits)
    const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 180) {
      return NextResponse.json({
        success: false,
        error: 'Date range cannot exceed 180 days',
        maxDays: 180,
        requestedDays: daysDiff,
      }, { status: 400 });
    }

    console.log(`[Financial Data] Fetching transactions from ${startDate} to ${endDate} (${daysDiff} days)`);

    // Initialize Amazon SP-API service
    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);

    // Fetch financial transactions
    const startTime = Date.now();
    const transactions = await amazon.getFinancialTransactions(startDate, endDate);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`[Financial Data] Retrieved ${transactions.length} event groups in ${duration}s`);

    // Parse and analyze the data
    const orderIds = FinancialEventsParser.extractOrderIds(transactions);
    const totalRevenue = FinancialEventsParser.calculateTotalRevenue(transactions);
    const totalFees = FinancialEventsParser.calculateTotalFees(transactions);
    const totalRefunds = FinancialEventsParser.calculateTotalRefunds(transactions);
    const feeBreakdown = FinancialEventsParser.getFeeBreakdown(transactions);
    const skuSummary = FinancialEventsParser.getSKUSummary(transactions);
    const refundSummary = FinancialEventsParser.getRefundSummary(transactions);

    // Get ALL SKUs by revenue (sorted) with refund data
    const allSKUs = Array.from(skuSummary.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([sku, data]) => {
        const refundData = refundSummary.get(sku) || { units: 0, refundAmount: 0 };
        return {
          sku,
          units: data.units,
          revenue: Number(data.revenue.toFixed(2)),
          fees: Number(data.fees.toFixed(2)),
          net: Number((data.revenue - data.fees).toFixed(2)),
          refundedUnits: refundData.units,
          refundAmount: Number(refundData.refundAmount.toFixed(2)),
          netUnits: data.units - refundData.units, // Units after returns
        };
      });
    
    // Get top 10 for the chart
    const topSKUs = allSKUs.slice(0, 10);

    // Calculate additional metrics
    const netRevenue = totalRevenue - totalFees;
    const profitMargin = totalRevenue > 0 ? ((netRevenue / totalRevenue) * 100) : 0;
    const feePercentage = totalRevenue > 0 ? ((totalFees / totalRevenue) * 100) : 0;

    // Format fee breakdown for response
    const feeBreakdownFormatted = Object.entries(feeBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([type, amount]) => ({
        feeType: type,
        amount: Number(amount.toFixed(2)),
        percentage: totalFees > 0 ? Number(((amount / totalFees) * 100).toFixed(2)) : 0
      }));

    const response: any = {
      success: true,
      dateRange: { start: startDate, end: endDate },
      performance: {
        durationSeconds: Number(duration),
        recordsPerSecond: Number((orderIds.length / Number(duration)).toFixed(2)),
      },
      summary: {
        eventGroups: transactions.length,
        uniqueOrders: orderIds.length,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalFees: Number(totalFees.toFixed(2)),
        totalRefunds: Number(totalRefunds.toFixed(2)),
        netRevenue: Number(netRevenue.toFixed(2)),
        uniqueSKUs: skuSummary.size,
        profitMargin: Number(profitMargin.toFixed(2)),
        feePercentage: Number(feePercentage.toFixed(2)),
        refundRate: orderIds.length > 0 ? Number(((refundSummary.size / orderIds.length) * 100).toFixed(2)) : 0,
      },
      feeBreakdown: feeBreakdownFormatted, // Detailed fee breakdown by type
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
      response.transactions = transactions;
    }

    console.log(`[Financial Data] Summary: ${orderIds.length} orders, $${totalRevenue.toFixed(2)} revenue, $${totalFees.toFixed(2)} fees, $${totalRefunds.toFixed(2)} refunds`);

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
