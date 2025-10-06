import { NextRequest, NextResponse } from 'next/server';
import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';
import { getAmazonCredentials } from '@/lib/services/amazon-sp-api/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');

    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      );
    }

    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);

    // Step 2: Check report status
    const reportStatus = await amazon.getReportStatus(reportId);

    return NextResponse.json({
      success: true,
      reportId,
      processingStatus: reportStatus.processingStatus,
      reportDocumentId: reportStatus.reportDocumentId,
      createdTime: reportStatus.createdTime,
      dataStartTime: reportStatus.dataStartTime,
      dataEndTime: reportStatus.dataEndTime,
    });
  } catch (error) {
    console.error('Error checking report status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check report status' },
      { status: 500 }
    );
  }
}
