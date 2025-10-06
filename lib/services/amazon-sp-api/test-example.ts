/**
 * Amazon SP-API Test Examples
 * 
 * These examples show how to use the Amazon SP-API service
 * Run these in a server-side context (API route or server action)
 */

import { AmazonSPAPIService } from './index';
import { getAmazonCredentials } from './config';
import { FinancialEventsParser } from './financial-events';

// ============================================================================
// EXAMPLE 1: Get Settlement Report
// ============================================================================

export async function testSettlementReport() {
  console.log('=== Testing Settlement Report ===');
  
  try {
    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);
    
    // Get last month's settlement data
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const year = lastMonth.getFullYear();
    const month = (lastMonth.getMonth() + 1).toString().padStart(2, '0');
    
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;
    
    console.log(`Fetching settlement report from ${startDate} to ${endDate}...`);
    
    const settlementData = await amazon.getSettlementReport(startDate, endDate);
    
    // Parse TSV data
    const lines = settlementData.split('\n');
    const headers = lines[0].split('\t');
    const rows = lines.slice(1).filter(line => line.trim());
    
    console.log(`✅ Retrieved ${rows.length} settlement records`);
    console.log(`Headers: ${headers.slice(0, 5).join(', ')}...`);
    
    return {
      success: true,
      recordCount: rows.length,
      headers,
      sampleRow: rows[0]?.split('\t'),
    };
    
  } catch (error) {
    console.error('❌ Settlement report test failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 2: Get Financial Transactions
// ============================================================================

export async function testFinancialTransactions() {
  console.log('=== Testing Financial Transactions ===');
  
  try {
    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);
    
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
    
    console.log('✅ Financial Transactions Summary:');
    console.log(`   Event Groups: ${transactions.length}`);
    console.log(`   Unique Orders: ${orderIds.length}`);
    console.log(`   Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`   Total Fees: $${totalFees.toFixed(2)}`);
    console.log(`   Net Revenue: $${(totalRevenue - totalFees).toFixed(2)}`);
    console.log(`   Unique SKUs: ${skuSummary.size}`);
    
    // Show top 5 SKUs
    const topSKUs = Array.from(skuSummary.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5);
    
    console.log('\n   Top 5 SKUs by Revenue:');
    topSKUs.forEach(([sku, data], index) => {
      console.log(`   ${index + 1}. ${sku}: ${data.units} units, $${data.revenue.toFixed(2)} revenue`);
    });
    
    return {
      success: true,
      eventGroups: transactions.length,
      orderCount: orderIds.length,
      totalRevenue,
      totalFees,
      netRevenue: totalRevenue - totalFees,
      skuCount: skuSummary.size,
      topSKUs: topSKUs.map(([sku, data]) => ({ sku, ...data })),
    };
    
  } catch (error) {
    console.error('❌ Financial transactions test failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 3: Get Monthly Transactions (Simplified)
// ============================================================================

export async function testMonthlyTransactions() {
  console.log('=== Testing Monthly Transactions ===');
  
  try {
    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    
    console.log(`Fetching transactions for ${year}-${month}...`);
    
    const transactions = await amazon.getMonthlyFinancialTransactions(year, month);
    
    console.log(`✅ Retrieved ${transactions.length} event groups for ${year}-${month}`);
    
    return {
      success: true,
      year,
      month,
      eventGroups: transactions.length,
    };
    
  } catch (error) {
    console.error('❌ Monthly transactions test failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 4: Get Inventory Report
// ============================================================================

export async function testInventoryReport() {
  console.log('=== Testing Inventory Report ===');
  
  try {
    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);
    
    console.log('Fetching inventory report...');
    
    const inventoryData = await amazon.getInventoryReport();
    
    // Parse TSV data
    const lines = inventoryData.split('\n');
    const headers = lines[0].split('\t');
    const rows = lines.slice(1).filter(line => line.trim());
    
    console.log(`✅ Retrieved ${rows.length} inventory records`);
    console.log(`Headers: ${headers.slice(0, 5).join(', ')}...`);
    
    return {
      success: true,
      recordCount: rows.length,
      headers,
    };
    
  } catch (error) {
    console.error('❌ Inventory report test failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 5: Get Returns Report
// ============================================================================

export async function testReturnsReport() {
  console.log('=== Testing Returns Report ===');
  
  try {
    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);
    
    // Get last 30 days of returns
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`Fetching returns from ${startDateStr} to ${endDateStr}...`);
    
    const returnsData = await amazon.getReturnsReport(startDateStr, endDateStr);
    
    // Parse TSV data
    const lines = returnsData.split('\n');
    const headers = lines[0].split('\t');
    const rows = lines.slice(1).filter(line => line.trim());
    
    console.log(`✅ Retrieved ${rows.length} return records`);
    
    return {
      success: true,
      recordCount: rows.length,
      dateRange: { start: startDateStr, end: endDateStr },
    };
    
  } catch (error) {
    console.error('❌ Returns report test failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 6: Large Date Range with Chunking
// ============================================================================

export async function testChunkedTransactions() {
  console.log('=== Testing Chunked Transactions ===');
  
  try {
    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);
    
    // Get entire year in 30-day chunks
    const year = new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    console.log(`Fetching transactions from ${startDate} to ${endDate} (chunked)...`);
    
    const transactions = await amazon.getFinancialTransactionsChunked(
      startDate,
      endDate,
      30 // 30-day chunks
    );
    
    console.log(`✅ Retrieved ${transactions.length} event groups for entire year`);
    
    return {
      success: true,
      eventGroups: transactions.length,
      dateRange: { start: startDate, end: endDate },
    };
    
  } catch (error) {
    console.error('❌ Chunked transactions test failed:', error);
    throw error;
  }
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

export async function runAllTests() {
  console.log('\n🚀 Starting Amazon SP-API Tests...\n');
  
  const results = {
    settlement: null as any,
    transactions: null as any,
    monthly: null as any,
    inventory: null as any,
    returns: null as any,
    chunked: null as any,
  };
  
  try {
    results.settlement = await testSettlementReport();
  } catch (error) {
    results.settlement = { success: false, error: error instanceof Error ? error.message : String(error) };
  }
  
  try {
    results.transactions = await testFinancialTransactions();
  } catch (error) {
    results.transactions = { success: false, error: error instanceof Error ? error.message : String(error) };
  }
  
  try {
    results.monthly = await testMonthlyTransactions();
  } catch (error) {
    results.monthly = { success: false, error: error instanceof Error ? error.message : String(error) };
  }
  
  try {
    results.inventory = await testInventoryReport();
  } catch (error) {
    results.inventory = { success: false, error: error instanceof Error ? error.message : String(error) };
  }
  
  try {
    results.returns = await testReturnsReport();
  } catch (error) {
    results.returns = { success: false, error: error instanceof Error ? error.message : String(error) };
  }
  
  try {
    results.chunked = await testChunkedTransactions();
  } catch (error) {
    results.chunked = { success: false, error: error instanceof Error ? error.message : String(error) };
  }
  
  console.log('\n✅ All tests completed!\n');
  console.log('Results:', JSON.stringify(results, null, 2));
  
  return results;
}
