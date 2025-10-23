import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { amazonFinancialLineItems, productSkus, skuMappings } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[Sales Velocity] 📊 Starting daily velocity calculation...');

    // Step 1: Get ALL sales data with daily breakdown
    console.log('[Sales Velocity] Step 1: Fetching all Amazon sales by date and SKU...');
    
    // CRITICAL: Amazon creates multiple line items per order (item, shipping, fees, etc.)
    // Each line item duplicates the item_price and net_revenue values
    // We must group by order_id FIRST, then aggregate by date/SKU
    // 
    // Use a CTE (Common Table Expression) to:
    // 1. Group by order_id to get one row per order (avoiding 7x multiplication)
    // 2. Then aggregate by date/SKU
    const dailySales = await db.execute(sql`
      WITH order_totals AS (
        SELECT 
          ${amazonFinancialLineItems.amazonSku} as amazon_sku,
          DATE(${amazonFinancialLineItems.postedDate}) as sale_date,
          ${amazonFinancialLineItems.orderId} as order_id,
          MAX(${amazonFinancialLineItems.itemPrice}) as item_price,
          MAX(${amazonFinancialLineItems.netRevenue}) as net_revenue
        FROM ${amazonFinancialLineItems}
        WHERE ${amazonFinancialLineItems.amazonSku} IS NOT NULL 
          AND ${amazonFinancialLineItems.transactionType} = 'sale'
          AND ${amazonFinancialLineItems.quantity} > 0
        GROUP BY 
          ${amazonFinancialLineItems.amazonSku},
          DATE(${amazonFinancialLineItems.postedDate}),
          ${amazonFinancialLineItems.orderId}
      ),
      mapped_skus AS (
        SELECT 
          ot.*,
          COALESCE(ps.sku, ot.amazon_sku) as bdi_sku
        FROM order_totals ot
        LEFT JOIN ${skuMappings} sm ON ot.amazon_sku = sm.external_identifier
        LEFT JOIN ${productSkus} ps ON sm.internal_sku_id = ps.id
      )
      SELECT 
        bdi_sku as "bdiSku",
        amazon_sku as "amazonSku",
        sale_date::text as "date",
        COUNT(*)::int as "units",
        SUM(item_price)::numeric as "grossRevenue",
        SUM(net_revenue)::numeric as "netRevenue"
      FROM mapped_skus
      GROUP BY bdi_sku, amazon_sku, sale_date
      ORDER BY bdi_sku, sale_date
    `);
    
    const dailySalesData = dailySales as unknown as Array<{
      bdiSku: string;
      amazonSku: string;
      date: string;
      units: number;
      grossRevenue: number;
      netRevenue: number;
    }>;

    console.log(`[Sales Velocity] ✅ Found ${dailySalesData.length} daily data points`);
    
    // DEBUG: Show first 5 raw data points
    console.log('[Sales Velocity] 🔍 First 5 daily data points:');
    dailySalesData.slice(0, 5).forEach(item => {
      console.log(`   ${item.date} | ${item.bdiSku} | ${item.amazonSku} | units: ${item.units} | gross: ${item.grossRevenue} | net: ${item.netRevenue}`);
    });

    // DEBUG: Check specifically for MQ20-D80W-U
    const mq20D80WUData = dailySalesData.filter(item => item.bdiSku === 'MQ20-D80W-U');
    console.log(`[Sales Velocity] 🔍 MQ20-D80W-U data points: ${mq20D80WUData.length}`);
    if (mq20D80WUData.length > 0) {
      console.log('[Sales Velocity] ✅ MQ20-D80W-U found in sales data!');
      mq20D80WUData.forEach(item => {
        console.log(`   ${item.date} | ${item.bdiSku} | ${item.amazonSku} | units: ${item.units} | gross: ${item.grossRevenue} | net: ${item.netRevenue}`);
      });
    } else {
      console.log('[Sales Velocity] ⚠️ MQ20-D80W-U not found in daily sales data');
    }

    // Step 2: Group by BDI SKU and build daily timeline
    console.log('[Sales Velocity] Step 2: Grouping by BDI SKU...');
    
    const skuMap = new Map<string, {
      amazonSku: string;
      dailyTimeline: Array<{ date: string; units: number; grossRevenue: number; netRevenue: number }>;
      totalUnits: number;
      totalGrossRevenue: number;
      totalNetRevenue: number;
    }>();

    dailySalesData.forEach(item => {
      const bdiSku = item.bdiSku || 'Unknown';
      
      if (!skuMap.has(bdiSku)) {
        skuMap.set(bdiSku, {
          amazonSku: item.amazonSku || '',
          dailyTimeline: [],
          totalUnits: 0,
          totalGrossRevenue: 0,
          totalNetRevenue: 0,
        });
      }

      const skuData = skuMap.get(bdiSku)!;
      skuData.dailyTimeline.push({
        date: item.date,
        units: item.units || 0,
        grossRevenue: parseFloat((item.grossRevenue || 0).toString()),
        netRevenue: parseFloat((item.netRevenue || 0).toString()),
      });
      skuData.totalUnits += item.units || 0;
      skuData.totalGrossRevenue += parseFloat((item.grossRevenue || 0).toString());
      skuData.totalNetRevenue += parseFloat((item.netRevenue || 0).toString());
    });

    console.log(`[Sales Velocity] ✅ Grouped into ${skuMap.size} unique BDI SKUs`);

    // Step 3: Calculate velocity metrics
    console.log('[Sales Velocity] Step 3: Calculating velocity metrics...');
    
    const velocityData = [];

    for (const [bdiSku, data] of skuMap.entries()) {
      const dates = data.dailyTimeline.map(d => d.date).sort();
      const daysActive = dates.length;
      const dailyVelocity = data.totalUnits / daysActive;

      const skuMetrics = {
        bdiSku,
        amazonSku: data.amazonSku,
        totalUnits: data.totalUnits,
        totalGrossRevenue: parseFloat(data.totalGrossRevenue.toFixed(2)),
        totalNetRevenue: parseFloat(data.totalNetRevenue.toFixed(2)),
        daysActive,
        dailyVelocity: parseFloat(dailyVelocity.toFixed(2)),
        firstSaleDate: dates[0],
        lastSaleDate: dates[dates.length - 1],
        dailyTimeline: data.dailyTimeline,
      };

      velocityData.push(skuMetrics);

      console.log(`[Sales Velocity] 📈 ${bdiSku}: ${data.totalUnits} units over ${daysActive} days = ${dailyVelocity.toFixed(2)} units/day`);
    }

    // Sort by daily velocity descending
    velocityData.sort((a, b) => b.dailyVelocity - a.dailyVelocity);

    console.log(`[Sales Velocity] ✅ Calculated velocity for ${velocityData.length} SKUs`);
    console.log(`[Sales Velocity] 🏆 Top 3 SKUs by velocity:`);
    velocityData.slice(0, 3).forEach((sku, i) => {
      console.log(`[Sales Velocity]   ${i + 1}. ${sku.bdiSku}: ${sku.dailyVelocity} units/day`);
    });

    // DEBUG: Check if MQ20-D80W-U is in the final results
    const mq20D80WUInResults = velocityData.find(sku => sku.bdiSku === 'MQ20-D80W-U');
    if (mq20D80WUInResults) {
      console.log(`[Sales Velocity] ✅ MQ20-D80W-U found in results: ${mq20D80WUInResults.totalUnits} units, ${mq20D80WUInResults.dailyVelocity} units/day`);
    } else {
      console.log(`[Sales Velocity] ⚠️ MQ20-D80W-U NOT found in final velocity results`);
    }

    return NextResponse.json({
      success: true,
      totalSkus: velocityData.length,
      totalDataPoints: dailySales.length,
      velocityData,
      calculatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Sales Velocity] ❌ Error calculating velocity:', error);
    return NextResponse.json(
      { error: 'Failed to calculate sales velocity', details: error.message },
      { status: 500 }
    );
  }
}
