/**
 * Amazon SP-API Test Connection Endpoint
 * 
 * Tests the Amazon SP-API integration without requiring database
 * 
 * Usage:
 * POST /api/amazon/test-connection
 * Body: { "testType": "auth" | "settlement" | "transactions" | "inventory" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';
import { getAmazonCredentials, getConfigStatus } from '@/lib/services/amazon-sp-api/config';
import { FinancialEventsParser } from '@/lib/services/amazon-sp-api';

export async function GET() {
  // Check configuration status
  const status = getConfigStatus();
  
  return NextResponse.json({
    configured: status.configured,
    missingFields: status.missingFields,
    message: status.configured 
      ? '✅ Amazon SP-API is configured. Use POST with testType to run tests.'
      : '❌ Amazon SP-API is not configured. Missing environment variables.',
  });
}

export async function POST(request: NextRequest) {
  try {
    // Read body once and extract all parameters
    const body = await request.json();
    const { testType = 'auth', startDate, endDate } = body;
    
    // Check if configured
    const status = getConfigStatus();
    if (!status.configured) {
      return NextResponse.json({
        success: false,
        error: 'Amazon SP-API not configured',
        missingFields: status.missingFields,
      }, { status: 400 });
    }

    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);

    // Run different tests based on testType
    switch (testType) {
      case 'auth':
        return await testAuthentication(amazon);
      
      case 'settlement':
        return await testSettlementReport(amazon);
      
      case 'transactions':
        return await testFinancialTransactions(amazon);
      
      case 'inventory':
        return await testInventoryReport(amazon);
      
      case 'quick':
        return await testQuickTransactions(amazon);
      
      case 'custom':
        return await testCustomDateRange(amazon, startDate, endDate);
      
      case 'listings':
        return await testOpenListings(amazon);
      
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown test type: ${testType}`,
          availableTests: ['auth', 'settlement', 'transactions', 'inventory', 'quick', 'custom'],
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Amazon test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function testAuthentication(amazon: AmazonSPAPIService) {
  console.log('🔐 Testing authentication...');
  
  try {
    // Just test if we can get a token
    amazon.clearAuthCache(); // Force fresh token
    
    // Try a simple API call (get current month transactions - just 1 day)
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    const transactions = await amazon.getFinancialTransactions(today, today);
    
    return NextResponse.json({
      success: true,
      test: 'authentication',
      message: '✅ Authentication successful!',
      details: {
        tokenObtained: true,
        apiCallSuccessful: true,
        eventGroupsRetrieved: transactions.length,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      test: 'authentication',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        tokenObtained: false,
        apiCallSuccessful: false,
      },
    }, { status: 500 });
  }
}

async function testSettlementReport(amazon: AmazonSPAPIService) {
  console.log('📊 Testing settlement report...');
  
  try {
    // Get last month's settlement
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const year = lastMonth.getFullYear();
    const month = (lastMonth.getMonth() + 1).toString().padStart(2, '0');
    
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-28`; // Safe end date
    
    console.log(`Fetching settlement from ${startDate} to ${endDate}...`);
    
    const settlementData = await amazon.getSettlementReport(startDate, endDate);
    
    // Parse TSV
    const lines = settlementData.split('\n');
    const headers = lines[0].split('\t');
    const rows = lines.slice(1).filter(line => line.trim());
    
    return NextResponse.json({
      success: true,
      test: 'settlement',
      message: '✅ Settlement report retrieved successfully!',
      dateRange: { start: startDate, end: endDate },
      data: {
        recordCount: rows.length,
        headers: headers.slice(0, 10), // First 10 headers
        sampleRow: rows[0]?.split('\t').slice(0, 5), // First 5 columns of first row
        totalLines: lines.length,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      test: 'settlement',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

async function testFinancialTransactions(amazon: AmazonSPAPIService) {
  console.log('💰 Testing financial transactions...');
  
  try {
    // Get current month transactions
    const now = new Date();
    const startDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;
    const endDate = now.toISOString().split('T')[0];
    
    console.log(`Fetching transactions from ${startDate} to ${endDate}...`);
    
    const transactions = await amazon.getFinancialTransactions(startDate, endDate);
    
    // Parse and analyze
    const orderIds = FinancialEventsParser.extractOrderIds(transactions);
    const totalRevenue = FinancialEventsParser.calculateTotalRevenue(transactions);
    const totalFees = FinancialEventsParser.calculateTotalFees(transactions);
    const skuSummary = FinancialEventsParser.getSKUSummary(transactions);
    
    // Get top 5 SKUs
    const topSKUs = Array.from(skuSummary.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([sku, data]) => ({
        sku,
        units: data.units,
        revenue: Number(data.revenue.toFixed(2)),
        fees: Number(data.fees.toFixed(2)),
        net: Number((data.revenue - data.fees).toFixed(2)),
      }));
    
    return NextResponse.json({
      success: true,
      test: 'transactions',
      message: '✅ Financial transactions retrieved successfully!',
      dateRange: { start: startDate, end: endDate },
      summary: {
        eventGroups: transactions.length,
        uniqueOrders: orderIds.length,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalFees: Number(totalFees.toFixed(2)),
        netRevenue: Number((totalRevenue - totalFees).toFixed(2)),
        uniqueSKUs: skuSummary.size,
      },
      topSKUs,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      test: 'transactions',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

async function testInventoryReport(amazon: AmazonSPAPIService) {
  console.log('📦 Testing inventory report...');
  
  try {
    console.log('Fetching inventory report...');
    
    const inventoryData = await amazon.getInventoryReport();
    
    // Parse TSV
    const lines = inventoryData.split('\n');
    const headers = lines[0].split('\t');
    const rows = lines.slice(1).filter(line => line.trim());
    
    return NextResponse.json({
      success: true,
      test: 'inventory',
      message: '✅ Inventory report retrieved successfully!',
      data: {
        recordCount: rows.length,
        headers: headers.slice(0, 10), // First 10 headers
        sampleRow: rows[0]?.split('\t').slice(0, 5), // First 5 columns
        totalLines: lines.length,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      test: 'inventory',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

async function testQuickTransactions(amazon: AmazonSPAPIService) {
  console.log('⚡ Testing quick transactions (last 3 days)...');
  
  try {
    // Get last 3 days only (fast test)
    const now = new Date();
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const startDate = threeDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];
    
    console.log(`Fetching transactions from ${startDate} to ${endDate}...`);
    
    const startTime = Date.now();
    const transactions = await amazon.getFinancialTransactions(startDate, endDate);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Quick analysis
    const orderIds = FinancialEventsParser.extractOrderIds(transactions);
    const totalRevenue = FinancialEventsParser.calculateTotalRevenue(transactions);
    const totalFees = FinancialEventsParser.calculateTotalFees(transactions);
    
    return NextResponse.json({
      success: true,
      test: 'quick',
      message: '✅ Quick test completed!',
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
        netRevenue: Number((totalRevenue - totalFees).toFixed(2)),
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      test: 'quick',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

async function testOpenListings(amazon: AmazonSPAPIService) {
  console.log('📋 Testing Open Listings report (no date restrictions)...');
  
  try {
    console.log('Fetching open listings report...');
    
    // Use the exact report type from your Python code
    const listingsData = await amazon.getCustomReport(
      '_GET_FLAT_FILE_OPEN_LISTINGS_DATA_'
    );
    
    // Parse TSV data
    const lines = listingsData.split('\n');
    const headers = lines[0].split('\t');
    const rows = lines.slice(1).filter(line => line.trim());
    
    // Get sample SKUs
    const sampleSKUs = rows.slice(0, 5).map(row => {
      const cols = row.split('\t');
      return {
        sku: cols[0] || 'N/A',
        asin: cols[1] || 'N/A',
        price: cols[2] || 'N/A',
        quantity: cols[3] || 'N/A',
      };
    });
    
    return NextResponse.json({
      success: true,
      test: 'listings',
      message: '✅ Open listings report retrieved successfully!',
      data: {
        totalSKUs: rows.length,
        headers: headers.slice(0, 10), // First 10 headers
        sampleSKUs,
        totalLines: lines.length,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      test: 'listings',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

async function testCustomDateRange(amazon: AmazonSPAPIService, startDate: string, endDate: string) {
  console.log(`📅 Testing custom date range: ${startDate} to ${endDate}...`);
  
  try {
    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'startDate and endDate are required for custom test',
        example: '{"testType": "custom", "startDate": "2024-09-01", "endDate": "2024-09-30"}',
      }, { status: 400 });
    }

    console.log(`Fetching transactions from ${startDate} to ${endDate}...`);
    
    const startTime = Date.now();
    const transactions = await amazon.getFinancialTransactions(startDate, endDate);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Full analysis
    const orderIds = FinancialEventsParser.extractOrderIds(transactions);
    const totalRevenue = FinancialEventsParser.calculateTotalRevenue(transactions);
    const totalFees = FinancialEventsParser.calculateTotalFees(transactions);
    const skuSummary = FinancialEventsParser.getSKUSummary(transactions);
    
    // Get top 10 SKUs
    const topSKUs = Array.from(skuSummary.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([sku, data]) => ({
        sku,
        units: data.units,
        revenue: Number(data.revenue.toFixed(2)),
        fees: Number(data.fees.toFixed(2)),
        net: Number((data.revenue - data.fees).toFixed(2)),
      }));
    
    return NextResponse.json({
      success: true,
      test: 'custom',
      message: '✅ Custom date range test completed!',
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
        netRevenue: Number((totalRevenue - totalFees).toFixed(2)),
        uniqueSKUs: skuSummary.size,
      },
      topSKUs,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      test: 'custom',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
