/**
 * Amazon Financial Data Range API Endpoint
 * 
 * Returns the date range of data available in the local database
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { amazonFinancialLineItems } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Get the earliest and latest dates from the database
    const dateRange = await db
      .select({
        earliestDate: sql<string>`MIN(posted_date)`,
        latestDate: sql<string>`MAX(posted_date)`,
        totalRecords: sql<number>`COUNT(*)`,
      })
      .from(amazonFinancialLineItems)
      .execute();

    if (!dateRange || dateRange.length === 0 || !dateRange[0].earliestDate) {
      return NextResponse.json({
        success: true,
        hasData: false,
        message: 'No data in local database',
      });
    }

    const { earliestDate, latestDate, totalRecords } = dateRange[0];

    // Check for gaps in the data (dates with no records)
    const gapCheck = await db
      .select({
        dateWithData: sql<string>`DATE(posted_date)`,
        recordCount: sql<number>`COUNT(*)`,
      })
      .from(amazonFinancialLineItems)
      .groupBy(sql`DATE(posted_date)`)
      .orderBy(sql`DATE(posted_date)`)
      .execute();

    // Calculate total days in range
    const start = new Date(earliestDate);
    const end = new Date(latestDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysWithData = gapCheck.length;
    const hasGaps = daysWithData < totalDays;

    return NextResponse.json({
      success: true,
      hasData: true,
      earliestDate: earliestDate.split('T')[0], // Return YYYY-MM-DD only
      latestDate: latestDate.split('T')[0],
      totalRecords: Number(totalRecords),
      totalDays,
      daysWithData,
      hasGaps,
      coverage: ((daysWithData / totalDays) * 100).toFixed(1),
    });
  } catch (error) {
    console.error('Error fetching financial data range:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch data range',
    }, { status: 500 });
  }
}

