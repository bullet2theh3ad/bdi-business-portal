'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface HolidayInfo {
  date: string;
  type: 'holiday' | 'soft-holiday' | 'neutral';
  holidayName?: string;
  daysFromHoliday?: number;
  isCaution: boolean;
  reason?: string;
}

interface HolidayDatePickerProps {
  id?: string;
  name?: string;
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  className?: string;
  showHolidayWarnings?: boolean;
  helpText?: string;
}

export function HolidayDatePicker({
  id,
  name,
  label,
  value,
  onChange,
  required = false,
  className = '',
  showHolidayWarnings = true,
  helpText
}: HolidayDatePickerProps) {
  const [holidayInfo, setHolidayInfo] = useState<HolidayInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Track internal value for uncontrolled mode
  const [internalValue, setInternalValue] = useState('');
  
  // Determine if this is controlled or uncontrolled
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  // Check holiday status when date changes
  useEffect(() => {
    if (!currentValue || !showHolidayWarnings) {
      setHolidayInfo(null);
      return;
    }

    const checkHolidayStatus = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/holidays/chinese/periods?date=${currentValue}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setHolidayInfo({
              date: currentValue,
              type: data.classification.type,
              holidayName: data.classification.holidayName,
              daysFromHoliday: data.classification.daysFromHoliday,
              isCaution: data.shipmentCaution.isCaution,
              reason: data.shipmentCaution.reason
            });
          }
        }
      } catch (error) {
        console.error('Error checking holiday status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(checkHolidayStatus, 300);
    return () => clearTimeout(timeoutId);
  }, [currentValue, showHolidayWarnings]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Update internal state for uncontrolled mode
    if (!isControlled) {
      setInternalValue(newValue);
    }
    
    // Call onChange if provided
    onChange?.(newValue);
  };

  const getInputClassName = () => {
    let baseClass = `mt-1 ${className}`;
    
    if (holidayInfo?.isCaution) {
      if (holidayInfo.type === 'holiday') {
        baseClass += ' border-red-500 bg-red-50 focus:ring-red-500';
      } else if (holidayInfo.type === 'soft-holiday') {
        baseClass += ' border-orange-400 bg-orange-50 focus:ring-orange-400';
      }
    }
    
    return baseClass;
  };

  const getHolidayBadge = () => {
    if (!holidayInfo?.isCaution) return null;

    if (holidayInfo.type === 'holiday') {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 mt-1">
          🚫 {holidayInfo.holidayName}
        </Badge>
      );
    } else if (holidayInfo.type === 'soft-holiday') {
      return (
        <Badge className="bg-orange-100 text-orange-800 border-orange-200 mt-1">
          ⚠️ {holidayInfo.reason}
        </Badge>
      );
    }

    return null;
  };

  const getHelpMessage = () => {
    if (holidayInfo?.isCaution) {
      if (holidayInfo.type === 'holiday') {
        return (
          <div className="mt-1 text-xs text-red-600 font-medium">
            🚫 No shipments during {holidayInfo.holidayName} holiday period
          </div>
        );
      } else if (holidayInfo.type === 'soft-holiday') {
        return (
          <div className="mt-1 text-xs text-orange-600">
            ⚠️ Caution: {holidayInfo.reason} - expect delays
          </div>
        );
      }
    }

    if (helpText) {
      return (
        <div className="mt-1 text-xs text-gray-600">
          {helpText}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-1">
      {label && (
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
          {isLoading && <span className="text-xs text-gray-400">🔄</span>}
        </Label>
      )}
      
      <Input
        id={id}
        name={name}
        type="date"
        value={isControlled ? value : undefined}
        defaultValue={!isControlled ? internalValue : undefined}
        onChange={handleDateChange}
        required={required}
        className={getInputClassName()}
      />
      
      {getHolidayBadge()}
      {getHelpMessage()}
    </div>
  );
}

// Hook for checking holiday status programmatically
export function useHolidayCheck(date: string) {
  const [holidayInfo, setHolidayInfo] = useState<HolidayInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!date) {
      setHolidayInfo(null);
      return;
    }

    const checkHolidayStatus = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/holidays/chinese/periods?date=${date}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setHolidayInfo({
              date,
              type: data.classification.type,
              holidayName: data.classification.holidayName,
              daysFromHoliday: data.classification.daysFromHoliday,
              isCaution: data.shipmentCaution.isCaution,
              reason: data.shipmentCaution.reason
            });
          }
        }
      } catch (error) {
        console.error('Error checking holiday status:', error);
        setHolidayInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(checkHolidayStatus, 300);
    return () => clearTimeout(timeoutId);
  }, [date]);

  return { holidayInfo, isLoading };
}
