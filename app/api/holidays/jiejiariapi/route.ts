/**
 * JieJiaRi API Chinese Holidays Endpoint
 * 
 * Uses the most accurate Chinese holiday API for official government data
 * GET /api/holidays/jiejiariapi?year=2026 - Get holidays for year
 * POST /api/holidays/jiejiariapi - Fetch and store holidays from JieJiaRi API
 */

import { NextRequest, NextResponse } from 'next/server';
import { jieJiaRiHolidaysService } from '@/lib/services/jiejiariapi-holidays';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const date = searchParams.get('date');

    if (date) {
      // Classify a specific date
      const classification = await jieJiaRiHolidaysService.classifyDate(date);
      return NextResponse.json({
        success: true,
        date,
        classification
      });
    }

    // Get stored holidays for the year
    const holidays = await jieJiaRiHolidaysService.getStoredHolidays(year);
    
    return NextResponse.json({
      success: true,
      year,
      count: holidays.length,
      holidays
    });
  } catch (error) {
    console.error('Error in JieJiaRi holidays GET:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch JieJiaRi holidays',
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

    console.log(`🎊 Fetching and storing JieJiaRi holidays for ${year}...`);

    // Fetch and store holidays using JieJiaRi API
    const holidays = await jieJiaRiHolidaysService.fetchAndStoreHolidays(year);
    
    return NextResponse.json({
      success: true,
      message: `Successfully fetched and stored JieJiaRi holidays for ${year}`,
      year,
      count: holidays.length,
      holidays
    });
  } catch (error) {
    console.error('Error in JieJiaRi holidays POST:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch and store JieJiaRi holidays',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
