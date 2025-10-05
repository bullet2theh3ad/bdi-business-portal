/**
 * Chinese Holiday Periods Service
 * 
 * Enhanced service that understands multi-day Chinese holiday periods
 * and calculates proper ±3 day buffer zones for shipment planning.
 */

import { db } from '@/lib/db/drizzle';
import { chineseHolidays } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export interface HolidayPeriod {
  id?: string;
  name: string;
  nameChinese?: string;
  year: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  duration: number;  // Number of days
  isOfficial: boolean;
  source: 'api' | 'manual' | 'government';
}

export interface DateClassification {
  date: string;
  type: 'holiday' | 'soft-holiday' | 'neutral';
  holidayName?: string;
  daysFromHoliday?: number; // Negative = before, positive = after, 0 = during
  holidayPeriod?: HolidayPeriod;
}

/**
 * Chinese Holiday Periods with accurate durations for 2024-2025
 * Based on official Chinese government holiday schedules
 */
export const CHINESE_HOLIDAY_PERIODS = {
  2024: [
    {
      name: "New Year's Day",
      nameChinese: "元旦",
      startDate: "2024-01-01",
      endDate: "2024-01-01",
      duration: 1
    },
    {
      name: "Spring Festival (Chinese New Year)",
      nameChinese: "春节",
      startDate: "2024-02-10", // Chinese New Year's Eve
      endDate: "2024-02-17",   // 8-day holiday period
      duration: 8
    },
    {
      name: "Qingming Festival (Tomb-Sweeping Day)",
      nameChinese: "清明节",
      startDate: "2024-04-04",
      endDate: "2024-04-06",
      duration: 3
    },
    {
      name: "Labour Day",
      nameChinese: "劳动节",
      startDate: "2024-05-01",
      endDate: "2024-05-05",
      duration: 5
    },
    {
      name: "Dragon Boat Festival",
      nameChinese: "端午节",
      startDate: "2024-06-10",
      endDate: "2024-06-10",
      duration: 1
    },
    {
      name: "Mid-Autumn Festival",
      nameChinese: "中秋节",
      startDate: "2024-09-15",
      endDate: "2024-09-17",
      duration: 3
    },
    {
      name: "National Day Golden Week",
      nameChinese: "国庆节",
      startDate: "2024-10-01",
      endDate: "2024-10-07",
      duration: 7
    }
  ],
  2025: [
    {
      name: "New Year's Day",
      nameChinese: "元旦",
      startDate: "2025-01-01",
      endDate: "2025-01-01",
      duration: 1
    },
    {
      name: "Spring Festival (Chinese New Year)",
      nameChinese: "春节",
      startDate: "2025-01-28", // Chinese New Year's Eve
      endDate: "2025-02-04",   // 8-day holiday period
      duration: 8
    },
    {
      name: "Qingming Festival (Tomb-Sweeping Day)",
      nameChinese: "清明节",
      startDate: "2025-04-04",
      endDate: "2025-04-06",
      duration: 3
    },
    {
      name: "Labour Day",
      nameChinese: "劳动节",
      startDate: "2025-05-01",
      endDate: "2025-05-05",
      duration: 5
    },
    {
      name: "Dragon Boat Festival",
      nameChinese: "端午节",
      startDate: "2025-05-31",
      endDate: "2025-06-02",
      duration: 3
    },
    {
      name: "Mid-Autumn Festival",
      nameChinese: "中秋节",
      startDate: "2025-10-06",
      endDate: "2025-10-08",
      duration: 3
    },
    {
      name: "National Day Golden Week",
      nameChinese: "国庆节",
      startDate: "2025-10-01",
      endDate: "2025-10-08",
      duration: 8
    }
  ]
};

export class ChineseHolidayPeriodsService {
  
  /**
   * Store holiday periods in database with proper start/end dates
   */
  async storeHolidayPeriods(year: number): Promise<HolidayPeriod[]> {
    try {
      const yearPeriods = CHINESE_HOLIDAY_PERIODS[year as keyof typeof CHINESE_HOLIDAY_PERIODS];
      if (!yearPeriods) {
        throw new Error(`No holiday period data available for year ${year}`);
      }

      const holidayRecords = yearPeriods.map(period => ({
        date: period.startDate, // Use start date as primary date
        name: period.name,
        nameChinese: period.nameChinese,
        year: year,
        startDate: period.startDate,
        endDate: period.endDate,
        duration: period.duration,
        isOfficial: true,
        isAdjustedWorkday: false,
        holidayType: 'public' as const,
        source: 'manual' as const, // Using our curated data
        fetchedAt: new Date()
      }));

      // Clear existing data for this year first
      await db
        .delete(chineseHolidays)
        .where(eq(chineseHolidays.year, year));

      // Insert new holiday periods
      await db
        .insert(chineseHolidays)
        .values(holidayRecords);

      console.log(`✅ Stored ${holidayRecords.length} holiday periods for ${year}`);
      
      return yearPeriods.map(period => ({
        name: period.name,
        nameChinese: period.nameChinese,
        year: year,
        startDate: period.startDate,
        endDate: period.endDate,
        duration: period.duration,
        isOfficial: true,
        source: 'manual' as const
      }));
    } catch (error) {
      console.error('Error storing holiday periods:', error);
      throw error;
    }
  }

  /**
   * Get all holiday periods for a year
   */
  async getHolidayPeriods(year: number): Promise<HolidayPeriod[]> {
    try {
      const data = await db
        .select()
        .from(chineseHolidays)
        .where(eq(chineseHolidays.year, year))
        .orderBy(chineseHolidays.startDate);

      return data.map(record => ({
        id: record.id,
        name: record.name,
        nameChinese: record.nameChinese || undefined,
        year: record.year,
        startDate: record.startDate,
        endDate: record.endDate,
        duration: record.duration,
        isOfficial: record.isOfficial || false,
        source: record.source as 'api' | 'manual' | 'government'
      }));
    } catch (error) {
      console.error('Error getting holiday periods:', error);
      return [];
    }
  }

  /**
   * Classify a date as holiday, soft-holiday, or neutral
   * This is the core function for UI highlighting
   */
  async classifyDate(date: string): Promise<DateClassification> {
    try {
      const targetDate = new Date(date);
      const year = targetDate.getFullYear();
      
      const holidayPeriods = await this.getHolidayPeriods(year);
      
      // Check if date falls within any holiday period
      for (const period of holidayPeriods) {
        const startDate = new Date(period.startDate);
        const endDate = new Date(period.endDate);
        
        if (targetDate >= startDate && targetDate <= endDate) {
          return {
            date,
            type: 'holiday',
            holidayName: period.name,
            daysFromHoliday: 0,
            holidayPeriod: period
          };
        }
      }

      // Check if date falls within ±3 day buffer of any holiday period
      for (const period of holidayPeriods) {
        const startDate = new Date(period.startDate);
        const endDate = new Date(period.endDate);
        
        // Calculate buffer zones
        const bufferStart = new Date(startDate);
        bufferStart.setDate(startDate.getDate() - 3);
        
        const bufferEnd = new Date(endDate);
        bufferEnd.setDate(endDate.getDate() + 3);
        
        if (targetDate >= bufferStart && targetDate < startDate) {
          // Before holiday period
          const daysFromHoliday = Math.ceil((startDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
          return {
            date,
            type: 'soft-holiday',
            holidayName: period.name,
            daysFromHoliday: -daysFromHoliday,
            holidayPeriod: period
          };
        }
        
        if (targetDate > endDate && targetDate <= bufferEnd) {
          // After holiday period
          const daysFromHoliday = Math.ceil((targetDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
          return {
            date,
            type: 'soft-holiday',
            holidayName: period.name,
            daysFromHoliday: daysFromHoliday,
            holidayPeriod: period
          };
        }
      }

      return {
        date,
        type: 'neutral'
      };
    } catch (error) {
      console.error('Error classifying date:', error);
      return { date, type: 'neutral' };
    }
  }

  /**
   * Get all dates in a range with their classifications
   * Useful for calendar rendering
   */
  async classifyDateRange(startDate: string, endDate: string): Promise<DateClassification[]> {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const classifications: DateClassification[] = [];
      
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const classification = await this.classifyDate(dateStr);
        classifications.push(classification);
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return classifications;
    } catch (error) {
      console.error('Error classifying date range:', error);
      return [];
    }
  }

  /**
   * Check if a date falls within any holiday period or buffer zone
   */
  async isShipmentCautionDate(date: string): Promise<{ 
    isCaution: boolean; 
    reason?: string; 
    holidayName?: string;
    type?: 'holiday' | 'soft-holiday';
  }> {
    const classification = await this.classifyDate(date);
    
    if (classification.type === 'holiday') {
      return {
        isCaution: true,
        reason: `During ${classification.holidayName} holiday period`,
        holidayName: classification.holidayName,
        type: 'holiday'
      };
    }
    
    if (classification.type === 'soft-holiday') {
      const beforeAfter = classification.daysFromHoliday! < 0 ? 'before' : 'after';
      const days = Math.abs(classification.daysFromHoliday!);
      return {
        isCaution: true,
        reason: `${days} day${days > 1 ? 's' : ''} ${beforeAfter} ${classification.holidayName}`,
        holidayName: classification.holidayName,
        type: 'soft-holiday'
      };
    }
    
    return { isCaution: false };
  }
}

// Export singleton instance
export const chineseHolidayPeriodsService = new ChineseHolidayPeriodsService();
