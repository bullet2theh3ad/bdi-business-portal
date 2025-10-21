import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { amazonFinancialLineItems, productSkus } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[Sales Velocity] 📊 Starting daily velocity calculation...');

    // Step 1: Get ALL sales data with daily breakdown
    console.log('[Sales Velocity] Step 1: Fetching all Amazon sales by date and SKU...');
    
    const dailySales = await db
      .select({
        bdiSku: amazonFinancialLineItems.bdiSku,
        amazonSku: amazonFinancialLineItems.amazonSku,
        date: sql<string>`DATE(${amazonFinancialLineItems.postedDate})::text`,
        units: sql<number>`COUNT(*)::int`,  // Count number of line items (orders)
        grossRevenue: sql<number>`SUM(${amazonFinancialLineItems.itemPrice})`,  // Total revenue (before fees)
        netRevenue: sql<number>`SUM(${amazonFinancialLineItems.netRevenue})`,  // Net revenue (after fees)
      })
      .from(amazonFinancialLineItems)
      .where(
        sql`${amazonFinancialLineItems.bdiSku} IS NOT NULL 
            AND ${amazonFinancialLineItems.quantity} > 0`  // Only positive quantities (sales, not refunds)
      )
      .groupBy(
        amazonFinancialLineItems.bdiSku,
        amazonFinancialLineItems.amazonSku,
        sql`DATE(${amazonFinancialLineItems.postedDate})`
      )
      .orderBy(
        amazonFinancialLineItems.bdiSku,
        sql`DATE(${amazonFinancialLineItems.postedDate})`
      );

    console.log(`[Sales Velocity] ✅ Found ${dailySales.length} daily data points`);
    
    // DEBUG: Show first 5 raw data points
    console.log('[Sales Velocity] 🔍 First 5 daily data points:');
    dailySales.slice(0, 5).forEach(item => {
      console.log(`   ${item.date} | ${item.bdiSku} | ${item.amazonSku} | units: ${item.units} | gross: ${item.grossRevenue} | net: ${item.netRevenue}`);
    });

    // Step 2: Group by BDI SKU and build daily timeline
    console.log('[Sales Velocity] Step 2: Grouping by BDI SKU...');
    
    const skuMap = new Map<string, {
      amazonSku: string;
      dailyTimeline: Array<{ date: string; units: number; grossRevenue: number; netRevenue: number }>;
      totalUnits: number;
      totalGrossRevenue: number;
      totalNetRevenue: number;
    }>();

    dailySales.forEach(item => {
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
