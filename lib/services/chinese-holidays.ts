/**
 * Chinese Holidays Service
 * 
 * Simple, reliable service to fetch and cache Chinese public holidays.
 * This service is completely isolated and won't impact existing functionality.
 */

import { db } from '@/lib/db/drizzle';
import { chineseHolidays } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface ChineseHoliday {
  id?: string;
  date: string; // YYYY-MM-DD format
  name: string; // English name
  nameChinese?: string; // Chinese name
  year: number;
  isOfficial: boolean;
  isAdjustedWorkday: boolean;
  holidayType: 'public' | 'traditional' | 'adjusted';
  source: 'api' | 'manual' | 'government';
  fetchedAt?: string;
}

export interface HolidayApiResponse {
  date: string;
  name: string;
  type?: string;
  substitute?: boolean;
}

/**
 * Chinese Holidays Service Class
 */
export class ChineseHolidaysService {
  constructor() {
    // No initialization needed for Drizzle
  }

  /**
   * Get holidays for a specific year from database
   */
  async getHolidaysForYear(year: number): Promise<ChineseHoliday[]> {
    try {
      const data = await db
        .select()
        .from(chineseHolidays)
        .where(eq(chineseHolidays.year, year))
        .orderBy(chineseHolidays.date);

      return data.map(this.mapDbToHoliday);
    } catch (error) {
      console.error('Error in getHolidaysForYear:', error);
      return [];
    }
  }

  /**
   * Check if a specific date is a holiday
   */
  async isHoliday(date: string): Promise<boolean> {
    try {
      const data = await db
        .select({ id: chineseHolidays.id })
        .from(chineseHolidays)
        .where(eq(chineseHolidays.date, date))
        .limit(1);

      return data.length > 0;
    } catch (error) {
      console.error('Error checking holiday status:', error);
      return false;
    }
  }

  /**
   * Fetch holidays from external API and store in database
   * Using Holiday API as primary source
   */
  async fetchAndStoreHolidays(year: number): Promise<ChineseHoliday[]> {
    try {
      console.log(`🎊 Fetching Chinese holidays for year ${year}...`);

      // Check if we already have data for this year
      const existingHolidays = await this.getHolidaysForYear(year);
      if (existingHolidays.length > 0) {
        console.log(`✅ Found ${existingHolidays.length} existing holidays for ${year}`);
        return existingHolidays;
      }

      // Fetch from Holiday API (free tier available)
      const holidays = await this.fetchFromHolidayAPI(year);
      
      if (holidays.length > 0) {
        // Store in database
        await this.storeHolidays(holidays);
        console.log(`✅ Stored ${holidays.length} holidays for ${year}`);
        return holidays;
      }

      // If API fails, use hardcoded major holidays as fallback
      const fallbackHolidays = this.getFallbackHolidays(year);
      await this.storeHolidays(fallbackHolidays);
      console.log(`⚠️ Using fallback holidays for ${year}: ${fallbackHolidays.length} holidays`);
      
      return fallbackHolidays;
    } catch (error) {
      console.error('Error fetching and storing holidays:', error);
      return this.getFallbackHolidays(year);
    }
  }

  /**
   * Fetch holidays from Holiday API
   */
  private async fetchFromHolidayAPI(year: number): Promise<ChineseHoliday[]> {
    try {
      // Using a free public holidays API
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/CN`);
      
      if (!response.ok) {
        throw new Error(`Holiday API responded with status: ${response.status}`);
      }

      const apiHolidays: HolidayApiResponse[] = await response.json();
      
      return apiHolidays.map(holiday => ({
        date: holiday.date,
        name: holiday.name,
        year: year,
        isOfficial: true,
        isAdjustedWorkday: holiday.substitute || false,
        holidayType: 'public' as const,
        source: 'api' as const,
        fetchedAt: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error fetching from Holiday API:', error);
      throw error;
    }
  }

  /**
   * Store holidays in database
   */
  private async storeHolidays(holidays: ChineseHoliday[]): Promise<void> {
    try {
      const dbHolidays = holidays.map(holiday => ({
        date: holiday.date,
        name: holiday.name,
        nameChinese: holiday.nameChinese,
        year: holiday.year,
        startDate: holiday.date, // Use same date for start/end for single-day holidays
        endDate: holiday.date,
        duration: 1,
        isOfficial: holiday.isOfficial,
        isAdjustedWorkday: holiday.isAdjustedWorkday,
        holidayType: holiday.holidayType,
        source: holiday.source,
        fetchedAt: holiday.fetchedAt ? new Date(holiday.fetchedAt) : new Date()
      }));

      // Use insert with onConflictDoNothing to avoid duplicates
      await db
        .insert(chineseHolidays)
        .values(dbHolidays)
        .onConflictDoNothing();
    } catch (error) {
      console.error('Error in storeHolidays:', error);
      throw error;
    }
  }

  /**
   * Fallback holidays for major Chinese holidays (when API fails)
   */
  private getFallbackHolidays(year: number): ChineseHoliday[] {
    // Major Chinese holidays that are consistent year-to-year
    const fallbackHolidays: ChineseHoliday[] = [
      {
        date: `${year}-01-01`,
        name: "New Year's Day",
        nameChinese: "元旦",
        year,
        isOfficial: true,
        isAdjustedWorkday: false,
        holidayType: 'public',
        source: 'manual'
      },
      {
        date: `${year}-05-01`,
        name: "Labour Day",
        nameChinese: "劳动节",
        year,
        isOfficial: true,
        isAdjustedWorkday: false,
        holidayType: 'public',
        source: 'manual'
      },
      {
        date: `${year}-10-01`,
        name: "National Day",
        nameChinese: "国庆节",
        year,
        isOfficial: true,
        isAdjustedWorkday: false,
        holidayType: 'public',
        source: 'manual'
      }
    ];

    // Add Chinese New Year (approximate - varies by lunar calendar)
    if (year === 2024) {
      fallbackHolidays.push({
        date: "2024-02-10",
        name: "Chinese New Year",
        nameChinese: "春节",
        year: 2024,
        isOfficial: true,
        isAdjustedWorkday: false,
        holidayType: 'public',
        source: 'manual'
      });
    } else if (year === 2025) {
      fallbackHolidays.push({
        date: "2025-01-29",
        name: "Chinese New Year",
        nameChinese: "春节",
        year: 2025,
        isOfficial: true,
        isAdjustedWorkday: false,
        holidayType: 'public',
        source: 'manual'
      });
    }

    return fallbackHolidays;
  }

  /**
   * Map database record to ChineseHoliday interface
   */
  private mapDbToHoliday(dbRecord: any): ChineseHoliday {
    return {
      id: dbRecord.id,
      date: dbRecord.date,
      name: dbRecord.name,
      nameChinese: dbRecord.nameChinese,
      year: dbRecord.year,
      isOfficial: dbRecord.isOfficial,
      isAdjustedWorkday: dbRecord.isAdjustedWorkday,
      holidayType: dbRecord.holidayType,
      source: dbRecord.source,
      fetchedAt: dbRecord.fetchedAt?.toISOString()
    };
  }

  /**
   * Get holiday statistics for debugging
   */
  async getHolidayStats(): Promise<{ totalHolidays: number; yearsCovered: number[]; lastFetch: string | null }> {
    try {
      const data = await db
        .select({
          year: chineseHolidays.year,
          fetchedAt: chineseHolidays.fetchedAt
        })
        .from(chineseHolidays)
        .orderBy(chineseHolidays.fetchedAt);

      const yearsCovered = [...new Set(data.map(h => h.year))].sort();
      const lastFetch = data.length > 0 ? data[data.length - 1].fetchedAt?.toISOString() || null : null;

      return {
        totalHolidays: data.length,
        yearsCovered,
        lastFetch
      };
    } catch (error) {
      console.error('Error in getHolidayStats:', error);
      return { totalHolidays: 0, yearsCovered: [], lastFetch: null };
    }
  }
}

// Export singleton instance
export const chineseHolidaysService = new ChineseHolidaysService();
