/**
 * Amazon Campaign Summary API
 * Returns aggregated campaign metrics by SKU
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

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');
    const country = searchParams.get('country');
    const uploadId = searchParams.get('uploadId');

    console.log('📊 Fetching campaign summary...');

    // Build query
    let query = supabaseService
      .from('amazon_campaign_data')
      .select('*');

    if (uploadId) {
      query = query.eq('upload_id', uploadId);
    }

    if (sku) {
      query = query.eq('extracted_sku', sku);
    }

    if (country) {
      query = query.eq('country', country);
    }

    const { data: campaigns, error } = await query;

    if (error) {
      console.error('❌ Error fetching campaigns:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        totalSpend: 0,
        totalSales: 0,
        totalOrders: 0,
        totalImpressions: 0,
        totalClicks: 0,
        avgAcos: 0,
        avgRoas: 0,
        avgCtr: 0,
        campaignCount: 0,
        bySku: [],
      });
    }

    // Calculate totals
    const totalSpend = campaigns.reduce((sum, c) => sum + (parseFloat(c.spend_converted as any) || 0), 0);
    const totalSales = campaigns.reduce((sum, c) => sum + (parseFloat(c.sales_converted as any) || 0), 0);
    const totalOrders = campaigns.reduce((sum, c) => sum + (c.orders || 0), 0);
    const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);

    const avgAcos = totalSales > 0 ? totalSpend / totalSales : 0;
    const avgRoas = totalSpend > 0 ? totalSales / totalSpend : 0;
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

    // Group by SKU
    const skuMap = new Map<string, any>();

    campaigns.forEach(campaign => {
      const sku = campaign.extracted_sku;
      if (!sku) return;

      if (!skuMap.has(sku)) {
        skuMap.set(sku, {
          sku,
          spend: 0,
          sales: 0,
          orders: 0,
          impressions: 0,
          clicks: 0,
          campaignCount: 0,
        });
      }

      const skuData = skuMap.get(sku);
      skuData.spend += parseFloat(campaign.spend_converted as any) || 0;
      skuData.sales += parseFloat(campaign.sales_converted as any) || 0;
      skuData.orders += campaign.orders || 0;
      skuData.impressions += campaign.impressions || 0;
      skuData.clicks += campaign.clicks || 0;
      skuData.campaignCount += 1;
    });

    // Calculate metrics per SKU
    const bySku = Array.from(skuMap.values()).map(skuData => ({
      ...skuData,
      acos: skuData.sales > 0 ? skuData.spend / skuData.sales : 0,
      roas: skuData.spend > 0 ? skuData.sales / skuData.spend : 0,
      ctr: skuData.impressions > 0 ? skuData.clicks / skuData.impressions : 0,
    })).sort((a, b) => b.spend - a.spend);

    console.log(`✅ Summary: ${campaigns.length} campaigns, ${bySku.length} SKUs`);

    return NextResponse.json({
      totalSpend,
      totalSales,
      totalOrders,
      totalImpressions,
      totalClicks,
      avgAcos,
      avgRoas,
      avgCtr,
      campaignCount: campaigns.length,
      bySku,
    });

  } catch (error: any) {
    console.error('❌ Campaign summary error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

