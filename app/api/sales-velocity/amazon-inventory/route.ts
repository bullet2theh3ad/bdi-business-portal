import { NextRequest, NextResponse } from 'next/server';
import { getAmazonCredentials, getConfigStatus } from '@/lib/services/amazon-sp-api/config';
import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';

export const dynamic = 'force-dynamic';

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Parse integer from string
 */
function parseInteger(value: string): number {
  if (!value || value === '') return 0;
  const num = parseInt(value);
  return isNaN(num) ? 0 : num;
}

export async function GET(request: NextRequest) {
  try {
    console.log('[Sales Velocity] Fetching Amazon FBA inventory report...');

    // Check Amazon API configuration
    const status = getConfigStatus();
    if (!status.configured) {
      return NextResponse.json({
        error: 'Amazon API not configured',
        totalSKUs: 0,
        totalUnits: 0,
        lastSyncDate: null,
        skuDetails: [],
      }, { status: 400 });
    }

    // Step 1: List available Amazon-Fulfilled Inventory reports
    console.log('[Sales Velocity] Step 1: Listing available reports...');
    const listResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/amazon/list-reports?reportType=GET_FBA_FULFILLMENT_CURRENT_INVENTORY_DATA&processingStatus=DONE`,
      { cache: 'no-store' }
    );

    if (!listResponse.ok) {
      throw new Error('Failed to list reports');
    }

    const listData = await listResponse.json();
    const reports = listData.reports || [];

    if (reports.length === 0) {
      console.log('[Sales Velocity] No available reports found');
      return NextResponse.json({
        error: 'No inventory reports available',
        totalSKUs: 0,
        totalUnits: 0,
        lastSyncDate: null,
        skuDetails: [],
      });
    }

    // Step 2: Get the latest report (first one in the list)
    const latestReport = reports[0];
    console.log(`[Sales Velocity] Step 2: Using latest report: ${latestReport.reportId}`);
    console.log(`[Sales Velocity] Created: ${latestReport.createdTime}`);

    if (!latestReport.reportDocumentId) {
      throw new Error('Report has no document ID');
    }

    // Step 3: Download the report
    console.log('[Sales Velocity] Step 3: Downloading report...');
    const downloadResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/amazon/download-report?documentId=${latestReport.reportDocumentId}`,
      { cache: 'no-store' }
    );

    if (!downloadResponse.ok) {
      throw new Error('Failed to download report');
    }

    const downloadData = await downloadResponse.json();
    const csvText = downloadData.content || ''; // Use 'content' not 'data'
    
    if (!csvText) {
      throw new Error('No content in downloaded report');
    }
    
    console.log(`[Sales Velocity] Report downloaded: ${csvText.split('\n').length} lines`);

    // Parse CSV data (comma-separated, not tab-separated)
    const lines = csvText.split('\n').filter((line: string) => line.trim());
    if (lines.length === 0) {
      return NextResponse.json({
        totalSKUs: 0,
        totalUnits: 0,
        lastSyncDate: new Date().toISOString(),
        skuDetails: [],
      });
    }

    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1);

    console.log(`[Sales Velocity] Headers found:`, headers.slice(0, 10));

    // Find column indices based on actual CSV format
    const skuIdx = headers.indexOf('sku');
    const fnskuIdx = headers.indexOf('fnsku');
    const asinIdx = headers.indexOf('asin');
    const conditionIdx = headers.indexOf('condition');
    const afnTotalQtyIdx = headers.indexOf('afn-total-quantity');

    console.log(`[Sales Velocity] Column indices: sku=${skuIdx}, asin=${asinIdx}, fnsku=${fnskuIdx}, qty=${afnTotalQtyIdx}`);

    // Parse inventory data
    const skuDetails: Array<{
      sku: string;
      asin: string;
      fnsku: string;
      condition: string;
      totalQuantity: number;
    }> = [];

    let totalUnits = 0;

    for (const row of rows) {
      const fields = parseCSVLine(row);
      
      const sku = fields[skuIdx] || '';
      const asin = fields[asinIdx] || '';
      const fnsku = fields[fnskuIdx] || '';
      const condition = fields[conditionIdx] || 'New';
      const totalQuantity = parseInteger(fields[afnTotalQtyIdx]);

      if (sku && totalQuantity > 0) {
        skuDetails.push({
          sku,
          asin,
          fnsku,
          condition,
          totalQuantity,
        });
        totalUnits += totalQuantity;
      }
    }

    // Sort by quantity descending
    skuDetails.sort((a, b) => b.totalQuantity - a.totalQuantity);

    const uniqueSKUs = skuDetails.length;

    console.log(`[Sales Velocity] Parsed ${uniqueSKUs} SKUs, ${totalUnits} total units`);

    return NextResponse.json({
      totalSKUs: uniqueSKUs,
      totalUnits,
      lastSyncDate: latestReport.createdTime || new Date().toISOString(),
      skuDetails,
    });
  } catch (error: any) {
    console.error('[Sales Velocity] Error fetching Amazon inventory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Amazon inventory', details: error.message },
      { status: 500 }
    );
  }
}
