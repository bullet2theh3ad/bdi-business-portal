'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface HolidayCalendarToggleProps {
  onToggle?: (enabled: boolean) => void;
  className?: string;
}

interface HolidayStats {
  totalHolidays: number;
  yearsCovered: number[];
  lastFetch: string | null;
}

export function HolidayCalendarToggle({ onToggle, className = '' }: HolidayCalendarToggleProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [holidayStats, setHolidayStats] = useState<HolidayStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load holiday statistics on component mount
  useEffect(() => {
    const loadHolidayStats = async () => {
      try {
        const response = await fetch('/api/holidays/chinese?stats=true');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setHolidayStats(data.stats);
          }
        }
      } catch (error) {
        console.error('Error loading holiday stats:', error);
      }
    };

    loadHolidayStats();
  }, []);

  const handleToggle = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    onToggle?.(newState);
  };

  const ensureHolidayData = async () => {
    setIsLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;

      // Ensure we have data for current and next year
      await Promise.all([
        fetch('/api/holidays/chinese/periods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year: currentYear })
        }),
        fetch('/api/holidays/chinese/periods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year: nextYear })
        })
      ]);

      // Reload stats
      const response = await fetch('/api/holidays/chinese?stats=true');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setHolidayStats(data.stats);
        }
      }
    } catch (error) {
      console.error('Error ensuring holiday data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant={isEnabled ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        className={`flex items-center gap-2 ${
          isEnabled 
            ? 'bg-red-600 hover:bg-red-700 text-white' 
            : 'border-red-200 text-red-700 hover:bg-red-50'
        }`}
      >
        🎊 Chinese Holidays
        {isEnabled && <span className="text-xs">ON</span>}
      </Button>

      {holidayStats && (
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <Badge variant="outline" className="text-xs">
            {holidayStats.totalHolidays} holidays
          </Badge>
          <Badge variant="outline" className="text-xs">
            {holidayStats.yearsCovered.join(', ')}
          </Badge>
        </div>
      )}

      {(!holidayStats || holidayStats.totalHolidays === 0) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={ensureHolidayData}
          disabled={isLoading}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          {isLoading ? '🔄 Loading...' : '📥 Load Holiday Data'}
        </Button>
      )}
    </div>
  );
}

// Hook for managing holiday calendar state
export function useHolidayCalendar() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [holidayClassifications, setHolidayClassifications] = useState<Map<string, any>>(new Map());

  const classifyDateRange = async (startDate: string, endDate: string) => {
    if (!isEnabled) return;

    try {
      const response = await fetch(`/api/holidays/chinese/periods?start=${startDate}&end=${endDate}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.classifications) {
          const newClassifications = new Map();
          data.classifications.forEach((classification: any) => {
            newClassifications.set(classification.date, classification);
          });
          setHolidayClassifications(newClassifications);
        }
      }
    } catch (error) {
      console.error('Error classifying date range:', error);
    }
  };

  const getDateClassification = (date: string) => {
    return holidayClassifications.get(date) || { type: 'neutral' };
  };

  const getDateStyle = (date: string) => {
    const classification = getDateClassification(date);
    
    switch (classification.type) {
      case 'holiday':
        return 'bg-red-600 text-white border-red-700 font-bold';
      case 'soft-holiday':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return '';
    }
  };

  return {
    isEnabled,
    setIsEnabled,
    classifyDateRange,
    getDateClassification,
    getDateStyle,
    holidayClassifications
  };
}
