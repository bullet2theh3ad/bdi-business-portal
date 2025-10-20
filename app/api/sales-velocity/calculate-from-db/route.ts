import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { amazonFinancialLineItems } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[Sales Velocity] Calculating velocity from amazon_financial_line_items...');

    // Query all line items and aggregate by SKU
    const velocityData = await db
      .select({
        sku: amazonFinancialLineItems.bdiSku,
        totalSales: sql<number>`SUM(CASE WHEN ${amazonFinancialLineItems.transactionType} = 'order' THEN ${amazonFinancialLineItems.quantity} ELSE 0 END)`,
        totalRevenue: sql<number>`SUM(CASE WHEN ${amazonFinancialLineItems.transactionType} = 'order' THEN ${amazonFinancialLineItems.netRevenue} ELSE 0 END)`,
        firstSaleDate: sql<string>`MIN(${amazonFinancialLineItems.postedDate})::text`,
        lastSaleDate: sql<string>`MAX(${amazonFinancialLineItems.postedDate})::text`,
      })
      .from(amazonFinancialLineItems)
      .where(sql`${amazonFinancialLineItems.bdiSku} IS NOT NULL`)
      .groupBy(amazonFinancialLineItems.bdiSku)
      .orderBy(sql`SUM(CASE WHEN ${amazonFinancialLineItems.transactionType} = 'order' THEN ${amazonFinancialLineItems.quantity} ELSE 0 END) DESC`);

    // Calculate days in period and daily velocity for each SKU
    const enrichedData = velocityData.map(item => {
      const firstDate = item.firstSaleDate ? new Date(item.firstSaleDate) : null;
      const lastDate = item.lastSaleDate ? new Date(item.lastSaleDate) : null;
      
      let daysInPeriod = 1;
      if (firstDate && lastDate) {
        daysInPeriod = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
      }

      const dailyVelocity = (item.totalSales || 0) / daysInPeriod;

      return {
        sku: item.sku || 'Unknown',
        totalSales: item.totalSales || 0,
        totalRevenue: item.totalRevenue || 0,
        firstSaleDate: item.firstSaleDate,
        lastSaleDate: item.lastSaleDate,
        daysInPeriod,
        dailyVelocity,
      };
    });

    console.log(`[Sales Velocity] Calculated velocity for ${enrichedData.length} SKUs`);

    return NextResponse.json({
      velocityData: enrichedData,
      totalSKUs: enrichedData.length,
      calculatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Sales Velocity] Error calculating velocity:', error);
    return NextResponse.json(
      { error: 'Failed to calculate sales velocity', details: error.message },
      { status: 500 }
    );
  }
}

