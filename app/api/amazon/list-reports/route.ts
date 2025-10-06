/**
 * Amazon SP-API List Reports
 * Lists existing reports that Amazon has already generated
 * Instead of requesting new reports, we can download existing ones
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAmazonCredentials, getConfigStatus } from '@/lib/services/amazon-sp-api/config';
import { AmazonSPAPIAuth } from '@/lib/services/amazon-sp-api/auth';
import { AmazonRateLimiter } from '@/lib/services/amazon-sp-api/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    const status = getConfigStatus();
    if (!status.configured) {
      return NextResponse.json({
        success: false,
        error: 'Not configured',
      }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('reportType') || 'GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE';
    const processingStatus = searchParams.get('processingStatus') || 'DONE';
    
    const credentials = getAmazonCredentials();
    const auth = new AmazonSPAPIAuth(credentials);
    const rateLimiter = new AmazonRateLimiter();

    console.log(`[List Reports] Listing reports of type: ${reportType}`);
    console.log(`[List Reports] Processing status: ${processingStatus}`);

    const reports = await rateLimiter.executeWithRetry(async () => {
      const path = '/reports/2021-06-30/reports';
      const queryParams: Record<string, string> = {
        reportTypes: reportType,
        processingStatuses: processingStatus,
        pageSize: '100', // Get up to 100 reports
      };

      const headers = await auth.getSignedHeaders(
        'GET',
        path,
        'sellingpartnerapi-na.amazon.com',
        queryParams
      );

      const queryString = new URLSearchParams(queryParams).toString();
      const url = `https://sellingpartnerapi-na.amazon.com${path}?${queryString}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to list reports: ${response.status} - ${errorText}`);
      }

      return await response.json();
    }, 'List Reports');

    const reportsList = reports.reports || [];
    
    console.log(`[List Reports] Found ${reportsList.length} reports`);

    // Format the response
    const formattedReports = reportsList.map((report: any) => ({
      reportId: report.reportId,
      reportType: report.reportType,
      processingStatus: report.processingStatus,
      createdTime: report.createdTime,
      processingEndTime: report.processingEndTime,
      reportDocumentId: report.reportDocumentId,
      dataStartTime: report.dataStartTime,
      dataEndTime: report.dataEndTime,
    }));

    return NextResponse.json({
      success: true,
      totalReports: formattedReports.length,
      reports: formattedReports,
      nextToken: reports.nextToken,
    });

  } catch (error) {
    console.error('[List Reports] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
