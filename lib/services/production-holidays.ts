/**
 * Production-Ready Chinese Holidays Service
 * 
 * Optimized for production deployment with:
 * - Server-side API calls only
 * - Pre-loaded holiday data
 * - Fast client-side lookups
 * - No external API dependencies on client
 */

// Pre-loaded official Chinese holidays for production
export const PRODUCTION_CHINESE_HOLIDAYS = {
  2024: {
    holidays: [
      { date: "2024-01-01", name: "New Year's Day", type: "holiday" },
      { date: "2024-02-10", name: "Spring Festival", type: "holiday" },
      { date: "2024-02-11", name: "Spring Festival", type: "holiday" },
      { date: "2024-02-12", name: "Spring Festival", type: "holiday" },
      { date: "2024-02-13", name: "Spring Festival", type: "holiday" },
      { date: "2024-02-14", name: "Spring Festival", type: "holiday" },
      { date: "2024-02-15", name: "Spring Festival", type: "holiday" },
      { date: "2024-02-16", name: "Spring Festival", type: "holiday" },
      { date: "2024-02-17", name: "Spring Festival", type: "holiday" },
      { date: "2024-05-01", name: "Labour Day", type: "holiday" },
      { date: "2024-10-01", name: "National Day", type: "holiday" },
      { date: "2024-10-02", name: "National Day", type: "holiday" },
      { date: "2024-10-03", name: "National Day", type: "holiday" },
      { date: "2024-10-04", name: "National Day", type: "holiday" },
      { date: "2024-10-05", name: "National Day", type: "holiday" },
      { date: "2024-10-06", name: "National Day", type: "holiday" },
      { date: "2024-10-07", name: "National Day", type: "holiday" }
    ]
  },
  2025: {
    holidays: [
      { date: "2025-01-01", name: "New Year's Day", type: "holiday" },
      { date: "2025-01-28", name: "Spring Festival", type: "holiday" },
      { date: "2025-01-29", name: "Spring Festival", type: "holiday" },
      { date: "2025-01-30", name: "Spring Festival", type: "holiday" },
      { date: "2025-01-31", name: "Spring Festival", type: "holiday" },
      { date: "2025-02-01", name: "Spring Festival", type: "holiday" },
      { date: "2025-02-02", name: "Spring Festival", type: "holiday" },
      { date: "2025-02-03", name: "Spring Festival", type: "holiday" },
      { date: "2025-02-04", name: "Spring Festival", type: "holiday" },
      { date: "2025-04-04", name: "Qingming Festival", type: "holiday" },
      { date: "2025-04-05", name: "Qingming Festival", type: "holiday" },
      { date: "2025-04-06", name: "Qingming Festival", type: "holiday" },
      { date: "2025-05-01", name: "Labour Day", type: "holiday" },
      { date: "2025-05-02", name: "Labour Day", type: "holiday" },
      { date: "2025-05-03", name: "Labour Day", type: "holiday" },
      { date: "2025-05-04", name: "Labour Day", type: "holiday" },
      { date: "2025-05-05", name: "Labour Day", type: "holiday" },
      { date: "2025-05-31", name: "Dragon Boat Festival", type: "holiday" },
      { date: "2025-06-01", name: "Dragon Boat Festival", type: "holiday" },
      { date: "2025-06-02", name: "Dragon Boat Festival", type: "holiday" },
      { date: "2025-10-01", name: "National Day", type: "holiday" },
      { date: "2025-10-02", name: "National Day", type: "holiday" },
      { date: "2025-10-03", name: "National Day", type: "holiday" },
      { date: "2025-10-04", name: "National Day", type: "holiday" },
      { date: "2025-10-05", name: "National Day", type: "holiday" },
      { date: "2025-10-06", name: "National Day", type: "holiday" },
      { date: "2025-10-07", name: "National Day", type: "holiday" },
      { date: "2025-10-08", name: "National Day", type: "holiday" }
    ]
  },
  2026: {
    holidays: [
      { date: "2026-01-01", name: "New Year's Day", type: "holiday" },
      { date: "2026-02-16", name: "Spring Festival", type: "holiday" },
      { date: "2026-02-17", name: "Spring Festival", type: "holiday" },
      { date: "2026-02-18", name: "Spring Festival", type: "holiday" },
      { date: "2026-02-19", name: "Spring Festival", type: "holiday" },
      { date: "2026-02-20", name: "Spring Festival", type: "holiday" },
      { date: "2026-02-21", name: "Spring Festival", type: "holiday" },
      { date: "2026-02-22", name: "Spring Festival", type: "holiday" },
      { date: "2026-04-05", name: "Qingming Festival", type: "holiday" },
      { date: "2026-05-01", name: "Labour Day", type: "holiday" },
      { date: "2026-06-19", name: "Dragon Boat Festival", type: "holiday" },
      { date: "2026-09-25", name: "Mid-Autumn Festival", type: "holiday" },
      { date: "2026-10-01", name: "National Day", type: "holiday" },
      { date: "2026-10-02", name: "National Day", type: "holiday" },
      { date: "2026-10-03", name: "National Day", type: "holiday" },
      { date: "2026-10-04", name: "National Day", type: "holiday" },
      { date: "2026-10-05", name: "National Day", type: "holiday" },
      { date: "2026-10-06", name: "National Day", type: "holiday" },
      { date: "2026-10-07", name: "National Day", type: "holiday" }
    ]
  }
};

/**
 * Production-optimized holiday classification
 * Fast client-side lookups without API calls
 */
export function classifyDateProduction(date: string): {
  type: 'holiday' | 'soft-holiday' | 'neutral';
  holidayName?: string;
} {
  const targetDate = new Date(date);
  const year = targetDate.getFullYear();
  const yearData = PRODUCTION_CHINESE_HOLIDAYS[year as keyof typeof PRODUCTION_CHINESE_HOLIDAYS];
  
  if (!yearData) {
    return { type: 'neutral' };
  }

  // Check if date is a holiday
  const holiday = yearData.holidays.find(h => h.date === date);
  if (holiday) {
    return {
      type: 'holiday',
      holidayName: holiday.name
    };
  }

  // Check if date is within ±3 days of any holiday
  for (const holiday of yearData.holidays) {
    const holidayDate = new Date(holiday.date);
    const diffDays = Math.abs((targetDate.getTime() - holidayDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 3 && diffDays > 0) {
      return {
        type: 'soft-holiday',
        holidayName: holiday.name
      };
    }
  }

  return { type: 'neutral' };
}

/**
 * Get holiday summary for a year (for UI display)
 */
export function getHolidaySummaryForYear(year: number): Array<{
  name: string;
  dates: string;
  period: number;
}> {
  if (year === 2025) {
    return [
      { name: "Spring Festival", dates: "Jan 28-Feb 4", period: 8 },
      { name: "Qingming Festival", dates: "Apr 4-6", period: 3 },
      { name: "Labour Day", dates: "May 1-5", period: 5 },
      { name: "Dragon Boat Festival", dates: "May 31-Jun 2", period: 3 },
      { name: "Mid-Autumn Festival", dates: "Oct 6", period: 1 },
      { name: "National Day", dates: "Oct 1-8", period: 8 }
    ];
  } else if (year === 2026) {
    return [
      { name: "Spring Festival", dates: "Feb 16-22", period: 7 },
      { name: "Qingming Festival", dates: "Apr 5", period: 1 },
      { name: "Labour Day", dates: "May 1", period: 1 },
      { name: "Dragon Boat Festival", dates: "Jun 19", period: 1 },
      { name: "Mid-Autumn Festival", dates: "Sep 25", period: 1 },
      { name: "National Day", dates: "Oct 1-7", period: 7 }
    ];
  } else if (year === 2027) {
    return [
      { name: "Spring Festival", dates: "Feb 5-11", period: 7 },
      { name: "Qingming Festival", dates: "Apr 5", period: 1 },
      { name: "Labour Day", dates: "May 1-2", period: 2 },
      { name: "Dragon Boat Festival", dates: "Jun 7-9", period: 3 },
      { name: "Mid-Autumn Festival", dates: "Sep 15-17", period: 3 },
      { name: "National Day", dates: "Oct 1-7", period: 7 }
    ];
  } else if (year === 2028) {
    return [
      { name: "Spring Festival", dates: "Jan 26", period: 1 },
      { name: "Qingming Festival", dates: "Apr 4", period: 1 },
      { name: "Labour Day", dates: "May 1", period: 1 },
      { name: "Dragon Boat Festival", dates: "Jun 25", period: 1 },
      { name: "Mid-Autumn Festival", dates: "Sep 13", period: 1 },
      { name: "National Day", dates: "Oct 1", period: 1 }
    ];
  }
  
  // Default for unknown years
  return [
    { name: "Spring Festival", dates: "Feb 1-8", period: 8 },
    { name: "Labour Day", dates: "May 1-5", period: 5 },
    { name: "National Day", dates: "Oct 1-7", period: 7 }
  ];
}
