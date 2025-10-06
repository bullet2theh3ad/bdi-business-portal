import { NextRequest, NextResponse } from 'next/server';
import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';
import { getAmazonCredentials } from '@/lib/services/amazon-sp-api/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportType, startDate, endDate } = body;

    if (!reportType) {
      return NextResponse.json(
        { error: 'Report type is required' },
        { status: 400 }
      );
    }

    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);

    // Map friendly names to Amazon report type IDs
    const reportTypeMap: Record<string, string> = {
      settlement: 'GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE',
      orders: 'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL',
      returns: 'GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA',
      fees: 'GET_FBA_ESTIMATED_FBA_FEES_TXT_DATA',
      inventory: 'GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA', // Merchant listings inventory
    };

    const amazonReportType = reportTypeMap[reportType] || reportType;

    // Step 1: Request the report
    // Note: Inventory and fee reports don't use date ranges
    const skipDates = ['inventory', 'fees'].includes(reportType);
    const reportId = await amazon.requestReport(
      amazonReportType, 
      skipDates ? undefined : startDate, 
      skipDates ? undefined : endDate
    );

    return NextResponse.json({
      success: true,
      reportId,
      message: 'Report requested successfully. Use the reportId to check status.',
    });
  } catch (error) {
    console.error('Error requesting report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to request report' },
      { status: 500 }
    );
  }
}
