/**
 * Chinese Holiday Periods API Endpoint
 * 
 * Enhanced API that handles multi-day holiday periods and buffer calculations
 * GET /api/holidays/chinese/periods?year=2024 - Get holiday periods for year
 * POST /api/holidays/chinese/periods - Store holiday periods for a year
 * GET /api/holidays/chinese/periods/classify?date=2024-02-10 - Classify a specific date
 * GET /api/holidays/chinese/periods/range?start=2024-02-01&end=2024-02-29 - Classify date range
 */

import { NextRequest, NextResponse } from 'next/server';
import { chineseHolidayPeriodsService } from '@/lib/services/chinese-holiday-periods';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const date = searchParams.get('date');
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const classify = searchParams.get('classify') === 'true';

    // Classify a specific date
    if (date) {
      const classification = await chineseHolidayPeriodsService.classifyDate(date);
      const cautionInfo = await chineseHolidayPeriodsService.isShipmentCautionDate(date);
      
      return NextResponse.json({
        success: true,
        date,
        classification,
        shipmentCaution: cautionInfo
      });
    }

    // Classify a date range
    if (startDate && endDate) {
      const classifications = await chineseHolidayPeriodsService.classifyDateRange(startDate, endDate);
      
      return NextResponse.json({
        success: true,
        startDate,
        endDate,
        count: classifications.length,
        classifications
      });
    }

    // Get holiday periods for the specified year
    const holidayPeriods = await chineseHolidayPeriodsService.getHolidayPeriods(year);
    
    return NextResponse.json({
      success: true,
      year,
      count: holidayPeriods.length,
      holidayPeriods
    });
  } catch (error) {
    console.error('Error in Chinese holiday periods GET:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch Chinese holiday periods',
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

    console.log(`🎊 Storing Chinese holiday periods for year ${year}...`);

    // Store holiday periods for the specified year
    const holidayPeriods = await chineseHolidayPeriodsService.storeHolidayPeriods(year);
    
    return NextResponse.json({
      success: true,
      message: `Successfully stored Chinese holiday periods for ${year}`,
      year,
      count: holidayPeriods.length,
      holidayPeriods
    });
  } catch (error) {
    console.error('Error in Chinese holiday periods POST:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to store Chinese holiday periods',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
