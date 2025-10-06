/**
 * Amazon SP-API Report Download Test
 * ONLY tests the 3-step report download process
 * Based on working Python code from BDI_2
 */

import { NextRequest, NextResponse } from 'next/server';
import { AmazonSPAPIClient } from '@/lib/services/amazon-sp-api/client';
import { getAmazonCredentials, getConfigStatus } from '@/lib/services/amazon-sp-api/config';
import { AmazonReportType } from '@/lib/services/amazon-sp-api/types';

export async function GET() {
  const status = getConfigStatus();
  
  return NextResponse.json({
    configured: status.configured,
    missingFields: status.missingFields,
    message: status.configured 
      ? '✅ Ready to download reports. Use POST with reportType.'
      : '❌ Not configured.',
    availableReports: [
      'settlement',
      'orders',
      'returns',
      'transactions',
      'fees',
      'inventory',
    ],
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportType = 'settlement', startDate, endDate } = body;
    
    // Check configuration
    const status = getConfigStatus();
    if (!status.configured) {
      return NextResponse.json({
        success: false,
        error: 'Not configured',
        missingFields: status.missingFields,
      }, { status: 400 });
    }

    const credentials = getAmazonCredentials();
    const client = new AmazonSPAPIClient(credentials);

    // Map simple names to actual report types
    let actualReportType: string;
    let useStartDate = startDate;
    let useEndDate = endDate;
    
    switch (reportType) {
      case 'settlement':
        // Use the exact same report type as your working Python code
        actualReportType = 'GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE';
        // Default to last month if no dates provided
        if (!startDate || !endDate) {
          const lastMonth = new Date();
          lastMonth.setMonth(lastMonth.getMonth() - 1);
          const year = lastMonth.getFullYear();
          const month = (lastMonth.getMonth() + 1).toString().padStart(2, '0');
          useStartDate = `${year}-${month}-01`;
          useEndDate = `${year}-${month}-28`;
        }
        break;
        
      case 'orders':
        actualReportType = AmazonReportType.FLAT_FILE_ORDERS;
        // Default to last month if no dates provided
        if (!startDate || !endDate) {
          const lastMonth = new Date();
          lastMonth.setMonth(lastMonth.getMonth() - 1);
          const year = lastMonth.getFullYear();
          const month = (lastMonth.getMonth() + 1).toString().padStart(2, '0');
          useStartDate = `${year}-${month}-01`;
          useEndDate = `${year}-${month}-28`;
        }
        break;
        
      case 'returns':
        actualReportType = AmazonReportType.FBA_RETURNS;
        // Default to last 30 days if no dates provided
        if (!startDate || !endDate) {
          const end = new Date();
          const start = new Date();
          start.setDate(start.getDate() - 30);
          useStartDate = start.toISOString().split('T')[0];
          useEndDate = end.toISOString().split('T')[0];
        }
        break;
      
      case 'transactions':
        // Try different transaction report types
        actualReportType = 'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL';
        if (!startDate || !endDate) {
          const lastMonth = new Date();
          lastMonth.setMonth(lastMonth.getMonth() - 1);
          const year = lastMonth.getFullYear();
          const month = (lastMonth.getMonth() + 1).toString().padStart(2, '0');
          useStartDate = `${year}-${month}-01`;
          useEndDate = `${year}-${month}-28`;
        }
        break;
      
      case 'fees':
        actualReportType = 'GET_FBA_ESTIMATED_FBA_FEES_TXT_DATA';
        // No date range needed for fee estimates
        useStartDate = undefined;
        useEndDate = undefined;
        break;
      
      case 'inventory':
        actualReportType = 'GET_FBA_INVENTORY_AGED_DATA';
        // No date range needed for inventory snapshot
        useStartDate = undefined;
        useEndDate = undefined;
        break;
        
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown report type: ${reportType}`,
          availableTypes: ['settlement', 'orders', 'returns'],
        }, { status: 400 });
    }

    console.log(`[Report Download] Type: ${reportType}`);
    console.log(`[Report Download] Date range: ${useStartDate} to ${useEndDate}`);
    
    const startTime = Date.now();
    
    // Step 1: Request report
    console.log('[Report Download] Step 1: Requesting report...');
    const reportId = await client.requestReport(
      actualReportType,
      useStartDate ? `${useStartDate}T00:00:00Z` : undefined,
      useEndDate ? `${useEndDate}T23:59:59Z` : undefined
    );
    console.log(`[Report Download] Report ID: ${reportId}`);
    
    // Step 2: Wait for report
    console.log('[Report Download] Step 2: Waiting for report to complete...');
    const documentId = await client.waitForReport(reportId);
    console.log(`[Report Download] Document ID: ${documentId}`);
    
    // Step 3: Download report
    console.log('[Report Download] Step 3: Downloading report...');
    const reportData = await client.downloadReport(documentId);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Parse report
    const lines = reportData.split('\n');
    const headers = lines[0]?.split('\t') || [];
    const dataRows = lines.slice(1).filter(line => line.trim());
    
    console.log(`[Report Download] ✅ Complete in ${duration}s - ${dataRows.length} records`);
    
    return NextResponse.json({
      success: true,
      reportType,
      dateRange: {
        start: useStartDate,
        end: useEndDate,
      },
      performance: {
        durationSeconds: Number(duration),
        reportId,
        documentId,
      },
      data: {
        totalRecords: dataRows.length,
        headers: headers.slice(0, 15), // First 15 headers
        sampleRows: dataRows.slice(0, 3).map(row => row.split('\t').slice(0, 5)), // First 3 rows, first 5 columns
        totalLines: lines.length,
      },
    });

  } catch (error) {
    console.error('[Report Download] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
