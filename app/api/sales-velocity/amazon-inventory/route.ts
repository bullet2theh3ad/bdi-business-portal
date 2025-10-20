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
    } else if (char === '\t' && !inQuotes) {
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
    console.log('[Sales Velocity] Downloading Amazon FBA inventory report...');

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

    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);

    // Download inventory report using the exact same logic as Amazon Reports
    const csvText = await amazon.getInventoryReport();
    
    console.log(`[Sales Velocity] Report downloaded: ${csvText.split('\n').length} lines`);

    // Parse TSV data
    const lines = csvText.split('\n').filter(line => line.trim());
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

    // Find column indices
    const sellerSkuIdx = headers.indexOf('seller-sku');
    const asinIdx = headers.indexOf('asin1');
    const fnskuIdx = headers.indexOf('fulfillment-channel-sku');
    const conditionIdx = headers.indexOf('condition');
    const afnTotalQtyIdx = headers.indexOf('afn-fulfillable-quantity');

    console.log(`[Sales Velocity] Column indices: sku=${sellerSkuIdx}, asin=${asinIdx}, fnsku=${fnskuIdx}, qty=${afnTotalQtyIdx}`);

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
      
      const sku = fields[sellerSkuIdx] || '';
      const asin = fields[asinIdx] || '';
      const fnsku = fields[fnskuIdx] || '';
      const condition = fields[conditionIdx] || 'SELLABLE';
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

    const uniqueSKUs = new Set(skuDetails.map(item => item.sku)).size;

    console.log(`[Sales Velocity] Parsed ${uniqueSKUs} SKUs, ${totalUnits} total units`);

    return NextResponse.json({
      totalSKUs: uniqueSKUs,
      totalUnits,
      lastSyncDate: new Date().toISOString(),
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

