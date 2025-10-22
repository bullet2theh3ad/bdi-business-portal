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

    // Format dates to YYYY-MM-DD (strip time and timezone)
    // Extract date directly without timezone conversion to avoid off-by-one errors
    const formatDate = (dateStr: string) => {
      // If the string already contains a date in YYYY-MM-DD format, extract it
      if (typeof dateStr === 'string' && dateStr.includes('-')) {
        return dateStr.split('T')[0].split(' ')[0];
      }
      // Fallback: use local date parts to avoid UTC conversion
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formattedEarliestDate = formatDate(earliestDate);
    const formattedLatestDate = formatDate(latestDate);

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
    const start = new Date(formattedEarliestDate);
    const end = new Date(formattedLatestDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysWithData = gapCheck.length;
    const hasGaps = daysWithData < totalDays;

    return NextResponse.json({
      success: true,
      hasData: true,
      earliestDate: formattedEarliestDate,
      latestDate: formattedLatestDate,
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

