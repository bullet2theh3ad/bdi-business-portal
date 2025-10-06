import { NextRequest, NextResponse } from 'next/server';
import { getAmazonCredentials } from '@/lib/services/amazon-sp-api/config';
import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';

/**
 * Discover available Amazon report types by testing them
 * GET /api/amazon/discover-reports
 */
export async function GET(request: NextRequest) {
  try {
    const credentials = getAmazonCredentials();
    if (!credentials) {
      return NextResponse.json(
        { error: 'Amazon SP-API not configured' },
        { status: 500 }
      );
    }

    const amazon = new AmazonSPAPIService(credentials);

    // Comprehensive list of Amazon SP-API report types to test
    const reportTypesToTest = [
      // Settlement Reports
      { type: 'GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE', category: 'Settlement', description: 'Settlement Report V2' },
      { type: 'GET_SETTLEMENT_REPORT_DATA_FLAT_FILE', category: 'Settlement', description: 'Settlement Report V1' },
      { type: 'GET_FLAT_FILE_PAYMENT_SETTLEMENT_DATA', category: 'Settlement', description: 'Payment Settlement Data' },
      
      // Financial Events
      { type: 'GET_V2_FINANCIAL_EVENTS_DATA_FLAT_FILE', category: 'Financial', description: 'Financial Events V2' },
      { type: 'GET_FINANCIAL_EVENTS_DATA_FLAT_FILE', category: 'Financial', description: 'Financial Events V1' },
      
      // Order Reports
      { type: 'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL', category: 'Orders', description: 'All Orders by Order Date' },
      { type: 'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_LAST_UPDATE_GENERAL', category: 'Orders', description: 'All Orders by Last Update' },
      { type: 'GET_AMAZON_FULFILLED_SHIPMENTS_DATA_GENERAL', category: 'Orders', description: 'Amazon Fulfilled Shipments' },
      { type: 'GET_FLAT_FILE_ACTIONABLE_ORDER_DATA_SHIPPING', category: 'Orders', description: 'Actionable Order Data' },
      
      // Returns & Refunds
      { type: 'GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA', category: 'Returns', description: 'FBA Customer Returns' },
      { type: 'GET_FLAT_FILE_RETURNS_DATA_BY_RETURN_DATE', category: 'Returns', description: 'Returns by Return Date' },
      { type: 'GET_FBA_REIMBURSEMENTS_DATA', category: 'Reimbursements', description: 'FBA Reimbursements' },
      { type: 'GET_XML_RETURNS_DATA_BY_RETURN_DATE', category: 'Returns', description: 'Returns XML Format' },
      
      // Inventory Reports
      { type: 'GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA', category: 'Inventory', description: 'FBA Manage Your Inventory' },
      { type: 'GET_FBA_INVENTORY_AGED_DATA', category: 'Inventory', description: 'FBA Inventory Aged Data' },
      { type: 'GET_FBA_MYI_ALL_INVENTORY_DATA', category: 'Inventory', description: 'FBA All Inventory Data' },
      { type: '_GET_FLAT_FILE_OPEN_LISTINGS_DATA_', category: 'Inventory', description: 'Open Listings Data' },
      { type: 'GET_MERCHANT_LISTINGS_ALL_DATA', category: 'Inventory', description: 'All Merchant Listings' },
      { type: 'GET_MERCHANT_LISTINGS_DATA', category: 'Inventory', description: 'Active Merchant Listings' },
      { type: 'GET_MERCHANT_LISTINGS_INACTIVE_DATA', category: 'Inventory', description: 'Inactive Merchant Listings' },
      { type: 'GET_STRANDED_INVENTORY_UI_DATA', category: 'Inventory', description: 'Stranded Inventory' },
      
      // Fee Reports
      { type: 'GET_FBA_ESTIMATED_FBA_FEES_TXT_DATA', category: 'Fees', description: 'Estimated FBA Fees' },
      { type: 'GET_FBA_FULFILLMENT_CURRENT_INVENTORY_DATA', category: 'Fees', description: 'Current Inventory' },
      { type: 'GET_FBA_STORAGE_FEE_CHARGES_DATA', category: 'Fees', description: 'Storage Fee Charges' },
      
      // Sales & Traffic
      { type: 'GET_SALES_AND_TRAFFIC_REPORT', category: 'Sales', description: 'Sales and Traffic Report' },
      { type: 'GET_V2_SELLER_PERFORMANCE_REPORT', category: 'Performance', description: 'Seller Performance V2' },
      
      // Tax Reports
      { type: 'GET_FLAT_FILE_SALES_TAX_DATA', category: 'Tax', description: 'Sales Tax Data' },
      { type: 'GET_VAT_TRANSACTION_DATA', category: 'Tax', description: 'VAT Transaction Data' },
      
      // Browse Tree Report
      { type: 'GET_XML_BROWSE_TREE_DATA', category: 'Catalog', description: 'Browse Tree Data' },
    ];

    console.log(`\n🧪 Testing ${reportTypesToTest.length} Amazon report types...`);

    const results = [];
    
    // Use past dates (December 2024) for testing
    const startDate = '2024-12-01T00:00:00Z';
    const endDate = '2024-12-31T23:59:59Z';

    for (const reportConfig of reportTypesToTest) {
      try {
        console.log(`\nTesting: ${reportConfig.type}`);
        
        // Try to request the report
        const result = await amazon.requestReport(
          reportConfig.type,
          startDate,
          endDate
        );

        results.push({
          reportType: reportConfig.type,
          category: reportConfig.category,
          description: reportConfig.description,
          status: '✅ AVAILABLE',
          message: 'Report can be requested',
          reportId: result.reportId,
        });

        console.log(`  ✅ AVAILABLE: ${reportConfig.description}`);

      } catch (error: any) {
        let status = '❌ ERROR';
        let message = error.message || String(error);

        if (message.includes('403')) {
          status = '🚫 FORBIDDEN';
          message = 'No permission for this report type';
        } else if (message.includes('400')) {
          if (message.toLowerCase().includes('not allowed') || message.toLowerCase().includes('invalid')) {
            status = '❌ NOT ALLOWED';
          } else {
            status = '❓ BAD REQUEST';
          }
        }

        results.push({
          reportType: reportConfig.type,
          category: reportConfig.category,
          description: reportConfig.description,
          status,
          message,
        });

        console.log(`  ${status}: ${message}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Categorize results
    const available = results.filter(r => r.status === '✅ AVAILABLE');
    const forbidden = results.filter(r => r.status === '🚫 FORBIDDEN');
    const notAllowed = results.filter(r => r.status === '❌ NOT ALLOWED');
    const errors = results.filter(r => r.status.includes('ERROR') || r.status.includes('BAD REQUEST'));

    const summary = {
      totalTested: reportTypesToTest.length,
      available: available.length,
      forbidden: forbidden.length,
      notAllowed: notAllowed.length,
      errors: errors.length,
    };

    console.log('\n📊 DISCOVERY RESULTS:');
    console.log(`Total tested: ${summary.totalTested}`);
    console.log(`Available: ${summary.available}`);
    console.log(`Forbidden: ${summary.forbidden}`);
    console.log(`Not Allowed: ${summary.notAllowed}`);
    console.log(`Errors: ${summary.errors}`);

    if (available.length > 0) {
      console.log('\n✅ AVAILABLE REPORT TYPES:');
      available.forEach(r => console.log(`  • ${r.reportType} - ${r.description}`));
    }

    return NextResponse.json({
      success: true,
      summary,
      results,
      availableReports: available,
      recommendations: available.length > 0 ? [
        'Use these working report types in your application',
        'Always use past dates, not future dates',
        'Some reports may not require date ranges (inventory, fees)',
      ] : [
        'Your account may not have report permissions',
        'Contact Amazon about enabling report access',
      ],
    });

  } catch (error: any) {
    console.error('Discovery error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to discover reports',
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
