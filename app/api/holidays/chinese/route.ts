/**
 * Chinese Holidays API Endpoint
 * 
 * Simple API to test and manage Chinese holidays data.
 * GET /api/holidays/chinese - Get holidays for current year
 * GET /api/holidays/chinese?year=2024 - Get holidays for specific year
 * POST /api/holidays/chinese - Fetch and store holidays for a year
 */

import { NextRequest, NextResponse } from 'next/server';
import { chineseHolidaysService } from '@/lib/services/chinese-holidays';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const stats = searchParams.get('stats') === 'true';

    if (stats) {
      // Return statistics about stored holidays
      const holidayStats = await chineseHolidaysService.getHolidayStats();
      return NextResponse.json({
        success: true,
        stats: holidayStats
      });
    }

    // Get holidays for the specified year
    const holidays = await chineseHolidaysService.getHolidaysForYear(year);
    
    return NextResponse.json({
      success: true,
      year,
      count: holidays.length,
      holidays
    });
  } catch (error) {
    console.error('Error in Chinese holidays GET:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch Chinese holidays',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const year = body.year || new Date().getFullYear();

    console.log(`🎊 Fetching Chinese holidays for year ${year}...`);

    // Fetch and store holidays for the specified year
    const holidays = await chineseHolidaysService.fetchAndStoreHolidays(year);
    
    return NextResponse.json({
      success: true,
      message: `Successfully fetched and stored Chinese holidays for ${year}`,
      year,
      count: holidays.length,
      holidays
    });
  } catch (error) {
    console.error('Error in Chinese holidays POST:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch and store Chinese holidays',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
