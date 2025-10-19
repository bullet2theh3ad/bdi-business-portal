/**
 * Amazon Campaign Data Upload API
 * Accepts CSV files from Amazon Advertising Console
 * Parses campaign data and stores in database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

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
 * Extract SKU from campaign name
 * Examples:
 *   "SP | MQ20 | Category Extended" -> "MQ20"
 *   "SP | MG8702 | Auto" -> "MG8702"
 *   "SP | B12 | Kw Target" -> "B12"
 */
function extractSkuFromCampaignName(campaignName: string): string | null {
  // Pattern: "SP | SKU | ..."
  const match = campaignName.match(/SP\s*\|\s*([A-Z0-9]+)\s*\|/i);
  return match ? match[1].trim() : null;
}

/**
 * Parse numeric value, handling currency symbols and commas
 */
function parseNumeric(value: string): number | null {
  if (!value || value === '0' || value === '') return null;
  
  // Remove currency symbols, commas, quotes
  const cleaned = value.replace(/[\$,"\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse percentage string to decimal
 * "<5%" -> null (unknown)
 * "7.74%" -> 7.74
 */
function parsePercentage(value: string): number | null {
  if (!value || value.includes('<')) return null;
  const cleaned = value.replace('%', '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse date string (MM/DD/YYYY)
 */
function parseDate(value: string): string | null {
  if (!value || value === '') return null;
  
  try {
    const [month, day, year] = value.split('/');
    if (!month || !day || !year) return null;
    
    // Return ISO format: YYYY-MM-DD
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  } catch {
    return null;
  }
}

/**
 * Parse CSV row to campaign data object
 */
function parseCampaignRow(row: string[], headers: string[]): any {
  const data: any = {};
  
  headers.forEach((header, index) => {
    data[header] = row[index] || '';
  });
  
  const campaignName = data['Campaigns'] || '';
  const extractedSku = extractSkuFromCampaignName(campaignName);
  
  return {
    campaignName,
    extractedSku,
    country: data['Country'] || null,
    state: data['State'] || null,
    status: data['Status'] || null,
    campaignType: data['Type'] || null,
    targeting: data['Targeting'] || null,
    
    biddingStrategy: data['Campaign bidding strategy'] || null,
    startDate: parseDate(data['Start date']),
    endDate: parseDate(data['End date']),
    avgTimeInBudget: parseNumeric(data['Avg. time in budget']),
    budgetConverted: parseNumeric(data['Budget (converted)']),
    budgetOriginal: data['Budget'] || null,
    costType: data['Cost type'] || null,
    
    impressions: parseInt(data['Impressions']) || 0,
    topOfSearchImpressionShare: data['Top-of-search impression share'] || null,
    topOfSearchBidAdjustment: parseNumeric(data['Top-of-search bid adjustment']),
    clicks: parseInt(data['Clicks']) || 0,
    ctr: parseNumeric(data['CTR']),
    
    spendConverted: parseNumeric(data['Spend (converted)']),
    spendOriginal: data['Spend'] || null,
    cpcConverted: parseNumeric(data['CPC (converted)']),
    cpcOriginal: data['CPC'] || null,
    
    detailPageViews: parseInt(data['Detail page views']) || 0,
    orders: parseInt(data['Orders']) || 0,
    salesConverted: parseNumeric(data['Sales (converted)']),
    salesOriginal: data['Sales'] || null,
    
    acos: parseNumeric(data['ACOS']),
    roas: parseNumeric(data['ROAS']),
    
    ntbOrders: parseInt(data['NTB orders']) || 0,
    percentOrdersNtb: parsePercentage(data['% of orders NTB']),
    ntbSalesConverted: parseNumeric(data['NTB sales (converted)']),
    ntbSalesOriginal: data['NTB sales'] || null,
    percentSalesNtb: parsePercentage(data['% of sales NTB']),
    
    longTermSalesConverted: parseNumeric(data['Long-term sales (converted)']),
    longTermSalesOriginal: data['Long-term sales'] || null,
    longTermRoas: parseNumeric(data['Long-term ROAS']),
    
    cumulativeReach: parseInt(data['Cumulative reach']) || 0,
    householdReach: parseInt(data['Household reach']) || 0,
    viewableImpressions: parseInt(data['Viewable impressions']) || 0,
    cpmConverted: parseNumeric(data['CPM (converted)']),
    cpmOriginal: data['CPM'] || null,
    vcpmConverted: parseNumeric(data['VCPM (converted)']),
    vcpmOriginal: data['VCPM'] || null,
    videoFirstQuartile: parseInt(data['Video first quartile']) || 0,
    videoMidpoint: parseInt(data['Video midpoint']) || 0,
    videoThirdQuartile: parseInt(data['Video third quartile']) || 0,
    videoComplete: parseInt(data['Video complete']) || 0,
    videoUnmute: parseInt(data['Video unmute']) || 0,
    vtr: parseNumeric(data['VTR']),
    vctr: parseNumeric(data['vCTR']),
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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`📤 Processing campaign upload: ${file.name}`);

    // Read CSV file
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty or invalid' }, { status: 400 });
    }

    // Parse CSV using a more robust method
    function parseCSVLine(line: string): string[] {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote
            current += '"';
            i++; // Skip next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // End of field
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      // Add last field
      result.push(current.trim());
      return result;
    }

    // Parse header row
    const headers = parseCSVLine(lines[0]);
    console.log(`📋 CSV Headers: ${headers.length} columns`);
    console.log(`📋 First 10 headers:`, headers.slice(0, 10));

    // Parse data rows
    const campaigns: any[] = [];
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (let i = 1; i < lines.length; i++) {
      try {
        const row = parseCSVLine(lines[i]);
        
        if (row.length < headers.length - 5) {
          // Allow some tolerance for missing trailing columns
          console.warn(`⚠️  Row ${i + 1} has ${row.length} columns, expected ${headers.length}, skipping`);
          continue;
        }

        // Pad row with empty strings if needed
        while (row.length < headers.length) {
          row.push('');
        }

        const campaign = parseCampaignRow(row, headers);
        
        // Only add if we have a valid campaign name
        if (campaign.campaignName && campaign.campaignName.trim()) {
          campaigns.push(campaign);

          // Track date range
          if (campaign.startDate) {
            const date = new Date(campaign.startDate);
            if (!minDate || date < minDate) minDate = date;
            if (!maxDate || date > maxDate) maxDate = date;
          }
        }
      } catch (error) {
        console.error(`❌ Error parsing row ${i + 1}:`, error);
      }
    }

    if (campaigns.length === 0) {
      return NextResponse.json({ error: 'No valid campaign data found in CSV' }, { status: 400 });
    }

    console.log(`✅ Parsed ${campaigns.length} campaigns`);

    // Create upload record
    const { data: upload, error: uploadError } = await supabaseService
      .from('amazon_campaign_uploads')
      .insert({
        file_name: file.name,
        uploaded_by: authUser.id,
        row_count: campaigns.length,
        date_range_start: minDate ? minDate.toISOString().split('T')[0] : null,
        date_range_end: maxDate ? maxDate.toISOString().split('T')[0] : null,
        status: 'completed',
      })
      .select()
      .single();

    if (uploadError || !upload) {
      console.error('❌ Error creating upload record:', uploadError);
      return NextResponse.json({ error: 'Failed to create upload record' }, { status: 500 });
    }

    console.log(`📦 Created upload record: ${upload.id}`);

    // Insert campaign data in batches
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < campaigns.length; i += batchSize) {
      const batch = campaigns.slice(i, i + batchSize).map(campaign => ({
        upload_id: upload.id,
        campaign_name: campaign.campaignName,
        extracted_sku: campaign.extractedSku,
        country: campaign.country,
        state: campaign.state,
        status: campaign.status,
        campaign_type: campaign.campaignType,
        targeting: campaign.targeting,
        bidding_strategy: campaign.biddingStrategy,
        start_date: campaign.startDate,
        end_date: campaign.endDate,
        avg_time_in_budget: campaign.avgTimeInBudget,
        budget_converted: campaign.budgetConverted,
        budget_original: campaign.budgetOriginal,
        cost_type: campaign.costType,
        impressions: campaign.impressions,
        top_of_search_impression_share: campaign.topOfSearchImpressionShare,
        top_of_search_bid_adjustment: campaign.topOfSearchBidAdjustment,
        clicks: campaign.clicks,
        ctr: campaign.ctr,
        spend_converted: campaign.spendConverted,
        spend_original: campaign.spendOriginal,
        cpc_converted: campaign.cpcConverted,
        cpc_original: campaign.cpcOriginal,
        detail_page_views: campaign.detailPageViews,
        orders: campaign.orders,
        sales_converted: campaign.salesConverted,
        sales_original: campaign.salesOriginal,
        acos: campaign.acos,
        roas: campaign.roas,
        ntb_orders: campaign.ntbOrders,
        percent_orders_ntb: campaign.percentOrdersNtb,
        ntb_sales_converted: campaign.ntbSalesConverted,
        ntb_sales_original: campaign.ntbSalesOriginal,
        percent_sales_ntb: campaign.percentSalesNtb,
        long_term_sales_converted: campaign.longTermSalesConverted,
        long_term_sales_original: campaign.longTermSalesOriginal,
        long_term_roas: campaign.longTermRoas,
        cumulative_reach: campaign.cumulativeReach,
        household_reach: campaign.householdReach,
        viewable_impressions: campaign.viewableImpressions,
        cpm_converted: campaign.cpmConverted,
        cpm_original: campaign.cpmOriginal,
        vcpm_converted: campaign.vcpmConverted,
        vcpm_original: campaign.vcpmOriginal,
        video_first_quartile: campaign.videoFirstQuartile,
        video_midpoint: campaign.videoMidpoint,
        video_third_quartile: campaign.videoThirdQuartile,
        video_complete: campaign.videoComplete,
        video_unmute: campaign.videoUnmute,
        vtr: campaign.vtr,
        vctr: campaign.vctr,
      }));

      const { error: insertError } = await supabaseService
        .from('amazon_campaign_data')
        .insert(batch);

      if (insertError) {
        console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, insertError);
        
        // Update upload status to failed
        await supabaseService
          .from('amazon_campaign_uploads')
          .update({ 
            status: 'failed', 
            error_message: insertError.message 
          })
          .eq('id', upload.id);
        
        return NextResponse.json({ error: 'Failed to insert campaign data' }, { status: 500 });
      }

      insertedCount += batch.length;
      console.log(`✅ Inserted batch ${i / batchSize + 1}: ${batch.length} campaigns`);
    }

    console.log(`🎉 Successfully imported ${insertedCount} campaigns`);

    return NextResponse.json({
      success: true,
      uploadId: upload.id,
      campaignsImported: insertedCount,
      dateRange: {
        start: upload.date_range_start,
        end: upload.date_range_end,
      },
    });

  } catch (error: any) {
    console.error('❌ Campaign upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

