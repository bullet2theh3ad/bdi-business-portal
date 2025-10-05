/**
 * JieJiaRi API Chinese Holidays Service
 * 
 * Uses the most accurate Chinese holiday API for official government data
 * API: https://www.jiejiariapi.com/en
 */

import { db } from '@/lib/db/drizzle';
import { chineseHolidays } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface JieJiaRiHoliday {
  date: string;
  name: string;
  isHoliday: boolean;
  holidayCategory: string;
  makeupWorkday: boolean;
}

export interface HolidayPeriod {
  id?: string;
  name: string;
  nameChinese?: string;
  year: number;
  startDate: string;
  endDate: string;
  duration: number;
  isOfficial: boolean;
  source: 'jiejiariapi' | 'manual' | 'government';
}

export class JieJiaRiHolidaysService {
  
  /**
   * Fetch holidays from JieJiaRi API for maximum accuracy
   */
  async fetchHolidaysFromAPI(year: number): Promise<JieJiaRiHoliday[]> {
    try {
      console.log(`🎊 Fetching ${year} holidays from JieJiaRi API...`);
      const response = await fetch(`https://www.jiejiariapi.com/api/v1/holidays?year=${year}`);
      
      if (!response.ok) {
        throw new Error(`JieJiaRi API responded with status: ${response.status}`);
      }

      const apiData = await response.json();
      
      if (!Array.isArray(apiData)) {
        console.log('JieJiaRi API returned non-array, treating as single holiday');
        return [apiData].filter(h => h.isHoliday === true);
      }

      const holidays = apiData.filter((holiday: JieJiaRiHoliday) => holiday.isHoliday === true);
      console.log(`✅ JieJiaRi API returned ${holidays.length} holidays for ${year}`);
      
      return holidays;
    } catch (error) {
      console.error(`❌ Error fetching from JieJiaRi API for ${year}:`, error);
      throw error;
    }
  }

  /**
   * Convert individual holiday dates to holiday periods
   * Groups consecutive dates into periods (e.g., Spring Festival, National Day)
   */
  private groupHolidaysIntoPeriods(holidays: JieJiaRiHoliday[], year: number): HolidayPeriod[] {
    if (holidays.length === 0) return [];

    // Sort holidays by date
    const sortedHolidays = holidays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const periods: HolidayPeriod[] = [];
    
    let currentPeriod: {
      name: string;
      nameChinese: string;
      startDate: string;
      endDate: string;
      dates: string[];
    } | null = null;

    for (const holiday of sortedHolidays) {
      const holidayDate = new Date(holiday.date);
      
      if (!currentPeriod) {
        // Start new period
        currentPeriod = {
          name: holiday.name,
          nameChinese: holiday.name,
          startDate: holiday.date,
          endDate: holiday.date,
          dates: [holiday.date]
        };
      } else {
        // Check if this holiday is consecutive to the current period
        const lastDate = new Date(currentPeriod.endDate);
        const daysDiff = Math.abs((holidayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 1 && holiday.name === currentPeriod.name) {
          // Extend current period
          currentPeriod.endDate = holiday.date;
          currentPeriod.dates.push(holiday.date);
        } else {
          // Finish current period and start new one
          periods.push({
            name: currentPeriod.name,
            nameChinese: currentPeriod.nameChinese,
            year: year,
            startDate: currentPeriod.startDate,
            endDate: currentPeriod.endDate,
            duration: currentPeriod.dates.length,
            isOfficial: true,
            source: 'jiejiariapi'
          });
          
          // Start new period
          currentPeriod = {
            name: holiday.name,
            nameChinese: holiday.name,
            startDate: holiday.date,
            endDate: holiday.date,
            dates: [holiday.date]
          };
        }
      }
    }

    // Don't forget the last period
    if (currentPeriod) {
      periods.push({
        name: currentPeriod.name,
        nameChinese: currentPeriod.nameChinese,
        year: year,
        startDate: currentPeriod.startDate,
        endDate: currentPeriod.endDate,
        duration: currentPeriod.dates.length,
        isOfficial: true,
        source: 'jiejiariapi'
      });
    }

    return periods;
  }

  /**
   * Fetch and store holidays for a year using JieJiaRi API
   */
  async fetchAndStoreHolidays(year: number): Promise<HolidayPeriod[]> {
    try {
      // Check if we already have data for this year
      const existingHolidays = await this.getStoredHolidays(year);
      if (existingHolidays.length > 0) {
        console.log(`✅ Found ${existingHolidays.length} existing holidays for ${year}`);
        return existingHolidays;
      }

      // Fetch from JieJiaRi API
      const apiHolidays = await this.fetchHolidaysFromAPI(year);
      const holidayPeriods = this.groupHolidaysIntoPeriods(apiHolidays, year);
      
      // Store in database
      await this.storeHolidayPeriods(holidayPeriods, year);
      
      console.log(`✅ Stored ${holidayPeriods.length} holiday periods for ${year}`);
      return holidayPeriods;
    } catch (error) {
      console.error(`❌ Error fetching and storing holidays for ${year}:`, error);
      // Fall back to predefined data if API fails
      return this.getFallbackHolidays(year);
    }
  }

  /**
   * Store holiday periods in database
   */
  private async storeHolidayPeriods(periods: HolidayPeriod[], year: number): Promise<void> {
    try {
      // Clear existing data for this year first
      await db
        .delete(chineseHolidays)
        .where(eq(chineseHolidays.year, year));

      const holidayRecords = periods.map(period => ({
        date: period.startDate,
        name: period.name,
        nameChinese: period.nameChinese,
        year: year,
        startDate: period.startDate,
        endDate: period.endDate,
        duration: period.duration,
        isOfficial: period.isOfficial,
        isAdjustedWorkday: false,
        holidayType: 'public' as const,
        source: period.source,
        fetchedAt: new Date()
      }));

      await db
        .insert(chineseHolidays)
        .values(holidayRecords);
    } catch (error) {
      console.error('Error storing holiday periods:', error);
      throw error;
    }
  }

  /**
   * Get stored holidays for a year
   */
  async getStoredHolidays(year: number): Promise<HolidayPeriod[]> {
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
        source: record.source as 'jiejiariapi' | 'manual' | 'government'
      }));
    } catch (error) {
      console.error('Error getting stored holidays:', error);
      return [];
    }
  }

  /**
   * Fallback holidays when API fails
   */
  private getFallbackHolidays(year: number): HolidayPeriod[] {
    // Use our predefined data as fallback
    const fallbackData = {
      2025: [
        { name: "Spring Festival", startDate: "2025-01-28", endDate: "2025-02-04", duration: 8 },
        { name: "National Day", startDate: "2025-10-01", endDate: "2025-10-08", duration: 8 }
      ],
      2026: [
        { name: "Spring Festival", startDate: "2026-02-16", endDate: "2026-02-22", duration: 7 },
        { name: "National Day", startDate: "2026-10-01", endDate: "2026-10-07", duration: 7 }
      ]
    };

    const yearData = fallbackData[year as keyof typeof fallbackData] || [];
    
    return yearData.map(holiday => ({
      name: holiday.name,
      year: year,
      startDate: holiday.startDate,
      endDate: holiday.endDate,
      duration: holiday.duration,
      isOfficial: true,
      source: 'manual' as const
    }));
  }

  /**
   * Classify a date as holiday, soft-holiday, or neutral
   */
  async classifyDate(date: string): Promise<{
    date: string;
    type: 'holiday' | 'soft-holiday' | 'neutral';
    holidayName?: string;
    daysFromHoliday?: number;
    holidayPeriod?: HolidayPeriod;
  }> {
    try {
      const targetDate = new Date(date);
      const year = targetDate.getFullYear();
      
      const holidayPeriods = await this.getStoredHolidays(year);
      
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
}

// Export singleton instance
export const jieJiaRiHolidaysService = new JieJiaRiHolidaysService();
