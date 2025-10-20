/**
 * Amazon FBA Inventory Sync API
 * Automatically requests, downloads, and processes inventory reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getAmazonCredentials, getConfigStatus } from '@/lib/services/amazon-sp-api/config';
import { AmazonSPAPIAuth } from '@/lib/services/amazon-sp-api/auth';
import { AmazonRateLimiter } from '@/lib/services/amazon-sp-api/rate-limiter';

// Service role client for bypassing RLS
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Parse boolean from CSV string
 */
function parseBoolean(value: string): boolean {
  return value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
}

/**
 * Parse integer from CSV string
 */
function parseInteger(value: string): number {
  if (!value || value === '') return 0;
  const num = parseInt(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse decimal from CSV string
 */
function parseDecimal(value: string): number | null {
  if (!value || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

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
 * Request a new inventory report from Amazon
 */
async function requestInventoryReport(credentials: any, auth: AmazonSPAPIAuth, rateLimiter: AmazonRateLimiter) {
  console.log('📤 Requesting new FBA inventory report...');
  
  const response = await rateLimiter.executeWithRetry(async () => {
    const accessToken = await auth.getAccessToken();
    const url = `${credentials.apiEndpoint}/reports/2021-06-30/reports`;
    
    const requestBody = {
      reportType: 'GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA',
      marketplaceIds: [credentials.marketplaceId],
    };
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to request report: ${error}`);
    }
    
    return res.json();
  });
  
  console.log(`✅ Report requested: ${response.reportId}`);
  return response.reportId;
}

/**
 * Poll report status until ready
 */
async function pollReportStatus(reportId: string, credentials: any, auth: AmazonSPAPIAuth, rateLimiter: AmazonRateLimiter, maxAttempts = 30) {
  console.log(`⏳ Polling report status: ${reportId}`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await rateLimiter.executeWithRetry(async () => {
      const accessToken = await auth.getAccessToken();
      const url = `${credentials.apiEndpoint}/reports/2021-06-30/reports/${reportId}`;
      
      const res = await fetch(url, {
        headers: {
          'x-amz-access-token': accessToken,
        },
      });
      
      if (!res.ok) {
        throw new Error(`Failed to check report status: ${res.statusText}`);
      }
      
      return res.json();
    });
    
    console.log(`📊 Report status: ${response.processingStatus} (attempt ${attempt + 1}/${maxAttempts})`);
    
    if (response.processingStatus === 'DONE') {
      return response.reportDocumentId;
    }
    
    if (response.processingStatus === 'FATAL' || response.processingStatus === 'CANCELLED') {
      throw new Error(`Report generation failed: ${response.processingStatus}`);
    }
    
    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error('Report generation timeout');
}

/**
 * Download report document
 */
async function downloadReport(documentId: string, credentials: any, auth: AmazonSPAPIAuth, rateLimiter: AmazonRateLimiter) {
  console.log(`📥 Downloading report document: ${documentId}`);
  
  // Get document info
  const docInfo = await rateLimiter.executeWithRetry(async () => {
    const accessToken = await auth.getAccessToken();
    const url = `${credentials.apiEndpoint}/reports/2021-06-30/documents/${documentId}`;
    
    const res = await fetch(url, {
      headers: {
        'x-amz-access-token': accessToken,
      },
    });
    
    if (!res.ok) {
      throw new Error(`Failed to get document info: ${res.statusText}`);
    }
    
    return res.json();
  });
  
  console.log(`📄 Document URL retrieved, downloading...`);
  
  // Download the actual report
  const reportResponse = await fetch(docInfo.url);
  if (!reportResponse.ok) {
    throw new Error(`Failed to download report: ${reportResponse.statusText}`);
  }
  
  const reportText = await reportResponse.text();
  console.log(`✅ Report downloaded: ${reportText.split('\n').length} lines`);
  
  return reportText;
}

/**
 * Parse and store inventory data
 */
async function parseAndStoreInventory(csvText: string, authUserId: string) {
  const lines = csvText.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid');
  }
  
  const headers = parseCSVLine(lines[0]);
  console.log(`📋 CSV Headers: ${headers.length} columns`);
  
  const snapshotDate = new Date().toISOString().split('T')[0]; // Today's date
  
  // Create upload record
  const { data: upload, error: uploadError } = await supabaseService
    .from('amazon_inventory_uploads')
    .insert({
      file_name: `auto_sync_${snapshotDate}.csv`,
      uploaded_by: authUserId,
      snapshot_date: snapshotDate,
      row_count: lines.length - 1,
      status: 'completed',
    })
    .select()
    .single();
  
  if (uploadError || !upload) {
    console.error('❌ Error creating upload record:', uploadError);
    throw new Error('Failed to create upload record');
  }
  
  console.log(`📦 Created upload record: ${upload.id}`);
  
  // Parse inventory data
  const inventoryRecords: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    try {
      const row = parseCSVLine(lines[i]);
      
      if (row.length < headers.length - 5) {
        console.warn(`⚠️  Row ${i + 1} has fewer columns, skipping`);
        continue;
      }
      
      // Pad row if needed
      while (row.length < headers.length) {
        row.push('');
      }
      
      const data: any = {};
      headers.forEach((header, index) => {
        data[header] = row[index] || '';
      });
      
      inventoryRecords.push({
        upload_id: upload.id,
        snapshot_date: snapshotDate,
        seller_sku: data['sku'] || '',
        fnsku: data['fnsku'] || null,
        asin: data['asin'] || null,
        product_name: data['product-name'] || null,
        condition: data['condition'] || null,
        your_price: parseDecimal(data['your-price']),
        mfn_listing_exists: parseBoolean(data['mfn-listing-exists']),
        mfn_fulfillable_quantity: parseInteger(data['mfn-fulfillable-quantity']),
        afn_listing_exists: parseBoolean(data['afn-listing-exists']),
        afn_warehouse_quantity: parseInteger(data['afn-warehouse-quantity']),
        afn_fulfillable_quantity: parseInteger(data['afn-fulfillable-quantity']),
        afn_unsellable_quantity: parseInteger(data['afn-unsellable-quantity']),
        afn_reserved_quantity: parseInteger(data['afn-reserved-quantity']),
        afn_total_quantity: parseInteger(data['afn-total-quantity']),
        per_unit_volume: parseDecimal(data['per-unit-volume']),
        afn_inbound_working_quantity: parseInteger(data['afn-inbound-working-quantity']),
        afn_inbound_shipped_quantity: parseInteger(data['afn-inbound-shipped-quantity']),
        afn_inbound_receiving_quantity: parseInteger(data['afn-inbound-receiving-quantity']),
        afn_researching_quantity: parseInteger(data['afn-researching-quantity']),
        afn_reserved_future_supply: parseInteger(data['afn-reserved-future-supply']),
        afn_future_supply_buyable: parseInteger(data['afn-future-supply-buyable']),
        store: data['store'] || null,
      });
    } catch (error) {
      console.error(`❌ Error parsing row ${i + 1}:`, error);
    }
  }
  
  if (inventoryRecords.length === 0) {
    throw new Error('No valid inventory data found in report');
  }
  
  console.log(`✅ Parsed ${inventoryRecords.length} inventory records`);
  
  // Insert in batches
  const batchSize = 100;
  let insertedCount = 0;
  
  for (let i = 0; i < inventoryRecords.length; i += batchSize) {
    const batch = inventoryRecords.slice(i, i + batchSize);
    
    const { error: insertError } = await supabaseService
      .from('amazon_inventory_snapshots')
      .insert(batch);
    
    if (insertError) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, insertError);
      throw new Error('Failed to insert inventory data');
    }
    
    insertedCount += batch.length;
    console.log(`✅ Inserted batch ${i / batchSize + 1}: ${batch.length} records`);
  }
  
  console.log(`🎉 Successfully imported ${insertedCount} inventory records`);
  
  return {
    uploadId: upload.id,
    recordsImported: insertedCount,
    snapshotDate,
  };
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesArray) => {
            cookiesArray.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Amazon API configuration
    const status = getConfigStatus();
    if (!status.configured) {
      return NextResponse.json({
        error: 'Amazon API not configured',
      }, { status: 400 });
    }

    const credentials = getAmazonCredentials();
    const auth = new AmazonSPAPIAuth(credentials);
    const rateLimiter = new AmazonRateLimiter();

    console.log('🚀 Starting automated inventory sync...');

    // Step 1: Request report
    const reportId = await requestInventoryReport(credentials, auth, rateLimiter);

    // Step 2: Poll until ready
    const documentId = await pollReportStatus(reportId, credentials, auth, rateLimiter);

    // Step 3: Download report
    const csvText = await downloadReport(documentId, credentials, auth, rateLimiter);

    // Step 4: Parse and store
    const result = await parseAndStoreInventory(csvText, authUser.id);

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error: any) {
    console.error('❌ Inventory sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

